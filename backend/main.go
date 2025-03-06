/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

package main

import (
    "encoding/json"
    "encoding/binary"
    "encoding/base64"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"golang.org/x/net/websocket"
)

func CreateDir(dir string) bool {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		err := os.MkdirAll(dir, 0755)
		if err != nil {
			return false
		}
	}
	return true
}

func Path() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	roomDir := filepath.Join(home, ".config", "tripleko")
	return roomDir
}

func Setup() {
	roomDir := Path()
	ok := CreateDir(roomDir)
	if !ok {
		log.Fatal("error creating room")
	}
}

type LoadJSON struct {
	SGF string `json:"sgf"`
	Loc string `json:"loc"`
	Prefs map[string]int `json:"prefs"`
	Buffer int64 `json:"buffer"`
	NextIndex int `json:"next_index"`
}

type EventJSON struct {
    Event string `json:"event"`
    Value interface{} `json:"value"`
    Color int `json:"color"`
    Mark string `json:"mark"`
	UserID string `json:"userid"`
}

func ErrorJSON(msg string) *EventJSON {
	return &EventJSON{"error", msg, 0, "", ""}
}

type Room struct {
    conns map[string]*websocket.Conn
    state *State
	timeLastEvent *time.Time
	lastUser string
	lastMessages map[string]*time.Time
	open bool
}

func NewRoom() *Room {
    conns := make(map[string]*websocket.Conn)
    state := NewState(19, true)
	now := time.Now()
	msgs := make(map[string]*time.Time)
    return &Room{conns, state, &now, "", msgs, true}
}

type Server struct {
    rooms map[string]*Room
}

func NewServer() *Server {
	return &Server{make(map[string]*Room)}
}

func (s *Server) Save() {
	for id,room := range s.rooms {
		path := filepath.Join(Path(), id)
		log.Printf("Saving %s", path)

		// the same process as a client handshake
        evt := room.state.InitData("handshake")
		data := []byte(evt.Value.(string))

		err := ioutil.WriteFile(path, data, 0644)
		if err != nil {
			log.Println(err)
		}
	}
}

func (s *Server) Load() {
	dir := Path()
	sgfs, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _,e := range sgfs {
		id := e.Name()
		path := filepath.Join(dir, id)
		data, err := ioutil.ReadFile(path)
		if err != nil {
			continue
		}

		load := &LoadJSON{}
		err = json.Unmarshal(data, load)
		if err != nil {
			continue
		}

		sgf, err := base64.StdEncoding.DecodeString(load.SGF)
		if err != nil {
			continue
		}

		state, err := FromSGF(string(sgf))
		if err != nil {
			continue
		}

		state.SetPrefs(load.Prefs)

		state.NextIndex = load.NextIndex
		state.InputBuffer = load.Buffer

		loc := load.Loc
		if loc != "" {
			dirs := strings.Split(loc, ",")
			for _ = range(dirs) {
				state.Right()
			}
		}

		log.Printf("Loading %s", path)

		r := NewRoom()
		r.state = state
		s.rooms[id] = r
		go s.Heartbeat(id)
	}
}

func (s *Server) Heartbeat(roomID string) {
    room,ok := s.rooms[roomID]
	if !ok {
		return
	}
	for {
		now := time.Now()
		diff := now.Sub(*room.timeLastEvent)
		log.Println(roomID, "Inactive for", diff)
		if diff.Seconds() > room.state.Timeout {
			room.open = false
			break
		}
		time.Sleep(3600*time.Second)
	}
    log.Println("Cleaning up board due to inactivity:", roomID)

	// close all the client connections
	for _,conn := range room.conns {
		conn.Close()
	}

	// delete the room from the server map
    delete(s.rooms, roomID)

	// delete the saved file (if it exists)
	path := filepath.Join(Path(), roomID)
	if _, err := os.Stat(path); err == nil {
		os.Remove(path)
	}

}

func ReadBytes(ws *websocket.Conn, size int) ([]byte, error) {
    chunkSize := 64
    message := []byte{}
    for {
        if len(message) >= size {
            break
        }
        l := size - len(message)
        if l > chunkSize {
            l = chunkSize
        }
        temp := make([]byte, l)
        n, err := ws.Read(temp)
        if err != nil {
            return nil, err
        }
        message = append(message, temp[:n]...)
    }

    return message, nil

}

// the url starts with '/'
func ParseURL(url string) (string, string, string) {
	tokens := strings.Split(url, "/")
	if len(tokens) <= 1 {
		return "", "", ""
	}
	if len(tokens) == 2 {
		return tokens[1], "", ""
	}
	if len(tokens) == 3 {
		return tokens[1], tokens[2], ""
	}
	return tokens[1], tokens[2], tokens[3]
}

// Echo the data received on the WebSocket.
func (s *Server) Handler(ws *websocket.Conn) {
    // new connection

    // first find the url they want
	url := ws.Request().URL.String()

	// currently not using the prefix, but i may someday
	_, roomID, op := ParseURL(url)

	if op == "sgf" {
		// if the room doesn't exist, send empty string
		data := ""
		if room, ok := s.rooms[roomID]; ok {
			data = room.state.ToSGF(false)
		}
		ws.Write([]byte(data))
		return
	} else if op == "sgfix" {
		// basically do the same thing but include indexes
		data := ""
		if room, ok := s.rooms[roomID]; ok {
			data = room.state.ToSGF(true)
		}
		ws.Write([]byte(data))
		return

	}

    // assign the new connection a new id
	id := uuid.New().String()
    log.Println(url, "Connecting:", id)

    // if the room they want doesn't exist, create it
    first := false
	if _, ok := s.rooms[roomID]; !ok {
        first = true
		log.Println("New room:", roomID)
		r := NewRoom()
		s.rooms[roomID] = r
		go s.Heartbeat(roomID)
	}
    room := s.rooms[roomID]
	room.conns[id] = ws

    // send initial state
    if !first {
        evt := room.state.InitData("handshake")
        if initData, err := json.Marshal(evt); err != nil {
            log.Println(id, err)
			return
        } else {
	        ws.Write(initData)
		}
    }

    // main loop
	for {
		// read in 4 bytes (length of rest of message)
        length_array := make([]byte, 4)
        _, err := ws.Read(length_array)
        if err != nil {
            log.Println(id, err)
            break
        }
        length := binary.LittleEndian.Uint32(length_array)

		// read in the rest of the data
        var data []byte

        if length > 1024 {
            data, err = ReadBytes(ws, int(length))
            if err != nil {
                log.Println(id, err)
                break
            }
        } else {
    		data = make([]byte, length)
    		_, err := ws.Read(data)
    
    		if err != nil {
    			log.Println(id, err)
                break
    		}
        }

		// turn data into json
        evt := &EventJSON{}
        if err := json.Unmarshal(data, evt); err != nil {
            log.Println(id, err)
            continue
        }

		if evt.Event == "debug" {
			log.Println(id, evt)
			continue
		}

		// handle pings
		//		no need to resend them
		if evt.Event == "ping" {
			continue
		}

		// handle timing
		// events allowable to skip buffer:
		// 		"update_buffer"
		//		"draw"
		if evt.Event != "update_buffer" && evt.Event != "draw" && room.lastUser != id {
			now := time.Now()
			diff := now.Sub(*room.timeLastEvent)
			if diff.Milliseconds() < room.state.InputBuffer {
				continue
			}
		}

		// handle fast users
		if evt.Event == "stone-toggle" || evt.Event == "stone-manual" {
			now := time.Now()
			if last,ok := room.lastMessages[id]; !ok {
				room.lastMessages[id] = &now
			} else {
				diff := now.Sub(*last)
				room.lastMessages[id] = &now
				if diff.Milliseconds() < 50 {
					continue
				}
			}
		}

		// handle event
        if (evt.Event == "upload_sgf") {
            decoded, err := base64.StdEncoding.DecodeString(evt.Value.(string))
            if err != nil {
                log.Println(err)
                continue
            }
            state, err := FromSGF(string(decoded))
            if err != nil {
                log.Println(err)
				newEvent := ErrorJSON("Error parsing SGF")
				data, _ := json.Marshal(newEvent)
				// broadcast error message
				for _, conn := range room.conns {
					conn.Write(data)
				}
                continue
            }
            room.state = state
			
			// replace evt with initdata
			evt = room.state.InitData("upload_sgf")
		} else if evt.Event == "request_sgf" {
			data, err := ApprovedFetch(evt.Value.(string))
			if err != nil {
				log.Println(err)
				newEvent := ErrorJSON(err.Error())
				data, _ := json.Marshal(newEvent)
				for _,conn := range room.conns {
					conn.Write(data)
				}
				continue
			}
			if data == "Permission denied" {
				newEvent := ErrorJSON("Error fetching SGF. Is it a private OGS game?")
				data, _ := json.Marshal(newEvent)
				for _,conn := range room.conns {
					conn.Write(data)
				}
				continue
			}
			state, err := FromSGF(string(data))
            if err != nil {
                log.Println(err)
				newEvent := ErrorJSON("Error parsing SGF")
				data, _ := json.Marshal(newEvent)
				// broadcast error message
				for _, conn := range room.conns {
					conn.Write(data)
				}
                continue
			}
			room.state = state
			evt = room.state.InitData("upload_sgf")
        } else if evt.Event == "trash" {
            // reset room
			oldBuffer := room.state.InputBuffer
            room.state = NewState(room.state.Size, true)

			// reuse old inputbuffer
			room.state.InputBuffer = oldBuffer
		} else if evt.Event == "update_settings" {
			sMap := evt.Value.(map[string]interface{})
			buffer := int64(sMap["buffer"].(float64))
			size := int(sMap["size"].(float64))
			settings := &Settings{buffer, size}

			room.state.InputBuffer = settings.Buffer
			if settings.Size != room.state.Size {
				// essentially trashing
				room.state = NewState(settings.Size, true)
				room.state.InputBuffer = buffer
			}
		} else {
            err = room.state.Add(evt)
			if err != nil {
				newEvent := ErrorJSON(err.Error())
				data, _ := json.Marshal(newEvent)
				// broadcast error message
				for _, conn := range room.conns {
					conn.Write(data)
				}
                continue
			}
        }

		// augment event with connection id
		evt.UserID = id

		// marshal event back into data
        data, err = json.Marshal(evt)
		if err != nil {
			fmt.Println(id, err)
            continue
        }

		// rebroadcast message
		for _, conn := range room.conns {
			conn.Write(data)
		}

		// set last user information
		room.lastUser = id
		now := time.Now()
		room.timeLastEvent = &now
	}

    // removes the client
	delete(room.conns, id)

   
}

func main() {
	Setup()

	cfg := websocket.Config{}

	s := NewServer()
	s.Load()

	ws := websocket.Server{
		cfg,
		nil,
		s.Handler,
	}
	http.Handle("/", ws)

	port := "9000"
	host := "localhost"
	url := fmt.Sprintf("%s:%s", host, port)

	log.Println("Listening on", url)

	// get ready to catch signals
	cancelChan := make(chan os.Signal, 1)

    // catch SIGETRM or SIGINTERRUPT
    signal.Notify(cancelChan, syscall.SIGTERM, syscall.SIGINT)

	go http.ListenAndServe(url, nil)
	sig := <-cancelChan

	log.Printf("Caught signal %v", sig)
	log.Println("Shutting down gracefully")

	s.Save()

	/*
	if err != nil {
		panic("ListenAndServe: " + err.Error())
	}
	*/
}


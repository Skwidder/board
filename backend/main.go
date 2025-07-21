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
	"strconv"
	"syscall"
	"time"

	"github.com/google/uuid"
	"golang.org/x/net/websocket"
	"golang.org/x/crypto/bcrypt"
)

func Hash(input string) string {
	hashedBytes, _ := bcrypt.GenerateFromPassword(
		[]byte(input),
		bcrypt.DefaultCost)
	return string(hashedBytes)
}

func Authorized(input, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(input))
	if err != nil {
		return false
	}
	return true
}

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

func Subpath(p string) string {
	return filepath.Join(Path(), p)
}

func RoomPath() string {
	return Subpath("rooms")
}

func MessagePath() string {
	return Subpath("messages")
}

func Setup() {
	roomDir := RoomPath()
	ok := CreateDir(roomDir)
	if !ok {
		log.Fatal("error creating room")
	}
	messageDir := MessagePath()
	ok = CreateDir(messageDir)
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
	Password string `json:"password"`
}

type EventJSON struct {
    Event string `json:"event"`
    Value interface{} `json:"value"`
    Color int `json:"color"`
	UserID string `json:"userid"`
}

func ErrorJSON(msg string) *EventJSON {
	return &EventJSON{"error", msg, 0, ""}
}

type Room struct {
    conns map[string]*websocket.Conn
    State *State
	timeLastEvent *time.Time
	lastUser string
	lastMessages map[string]*time.Time
	open bool
	OGSLink *OGSConnector
	password string
	auth map[string]bool
	nicks map[string]string
}

func NewRoom() *Room {
    conns := make(map[string]*websocket.Conn)
    state := NewState(19, true)
	now := time.Now()
	msgs := make(map[string]*time.Time)
	auth := make(map[string]bool)
	nicks := make(map[string]string)
    return &Room{conns, state, &now, "", msgs, true, nil, "", auth, nicks}
}

func (r *Room) HasPassword() bool {
	return r.password != ""
}

func SendEvent(conn *websocket.Conn, evt *EventJSON) {
	// marshal event back into data
	data, err := json.Marshal(evt)
	if err != nil {
		log.Println(err)
		return
    }
	conn.Write(data)
}

func (r *Room) Broadcast(evt *EventJSON, id string, setTime bool) {
	// augment event with connection id
	evt.UserID = id

	// marshal event back into data
	data, err := json.Marshal(evt)
	if err != nil {
		log.Println(id, err)
		return
    }

	// rebroadcast message
	for _, conn := range r.conns {
		conn.Write(data)
	}

	if setTime {
		// set last user information
		r.lastUser = id
		now := time.Now()
		r.timeLastEvent = &now
	}
}

func (r *Room) PushHead(x, y, col int) *EventJSON {
	r.State.PushHead(x, y, col)
	evt := &EventJSON{
		Event: "push_head",
		Value: []int{x, y},
		Color: col,
		UserID: "",
	}
	return evt
}

func (r *Room) UploadSGF(sgf string) *EventJSON {
    state, err := FromSGF(sgf)
    if err != nil {
        log.Println(err)
		return ErrorJSON("Error parsing SGF")
    }
    r.State = state
	
	// replace evt with initdata
	return r.State.InitData("upload_sgf")
}

func (r *Room) SendUserList() {
	// send list of currently connected users
	evt := &EventJSON {
		"connected_users",
		r.nicks,
		0,
		"",
	}

	r.Broadcast(evt, "", false)
}

type Server struct {
    rooms map[string]*Room
	messages []*Message
}

func NewServer() *Server {
	return &Server{
		make(map[string]*Room),
		[]*Message{},
	}
}

func (s *Server) Save() {
	for id,room := range s.rooms {
		path := filepath.Join(RoomPath(), id)
		log.Printf("Saving %s", path)

		// the same process as a client handshake
        evt := room.State.InitData("handshake")
		dataStruct := &LoadJSON{}
		s,_ := evt.Value.(string)
		err := json.Unmarshal([]byte(s), dataStruct)
		if err != nil {
			continue
		}

		dataStruct.Password = room.password
		data, err := json.Marshal(dataStruct)
		if err != nil {
			continue
		}

		err = ioutil.WriteFile(path, data, 0644)
		if err != nil {
			log.Println(err)
		}
	}
}

func (s *Server) Load() {
	dir := RoomPath()
	sgfs, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _,e := range sgfs {
		log.Println(e)
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
		r.password = load.Password
		r.State = state
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
		if diff.Seconds() > room.State.Timeout {
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
	path := filepath.Join(RoomPath(), roomID)
	if _, err := os.Stat(path); err == nil {
		os.Remove(path)
	}
}

type MessageJSON struct {
	Text string `json:"message"`
	TTL int `json:"ttl"`
}

type Message struct {
	Text string
	ExpiresAt *time.Time
	Notified map[string]bool
}

func (s *Server) ReadMessages() {
	// iterate through all files in the message path
	files, err := os.ReadDir(MessagePath())
	if err != nil {
		log.Fatal(err)
	}

	// check messages
	for _, file := range files {
		// might do something someday with nested directories
		if file.IsDir() {
			continue
		}

		// read each file
		path := filepath.Join(MessagePath(), file.Name())
		data, err := ioutil.ReadFile(path)
		if err != nil {
			continue
		}

		// convert json to struct
		msg := &MessageJSON{}
		err = json.Unmarshal(data, msg)
		if err != nil {
			continue
		}

		// remove the file
		os.Remove(path)

		// calculate the expiration time using TTL
		now := time.Now()
		expiresAt := now.Add(time.Duration(msg.TTL) * time.Second)

		// add to server messages
		m := &Message{msg.Text, &expiresAt, make(map[string]bool)}
		s.messages = append(s.messages, m)
	}
}

func (s *Server) SendMessages() {
	// go through each server message
	keep := []*Message{}
	for _, m := range s.messages {
		// check time
		now := time.Now()

		// skip the expired messages
		if m.ExpiresAt.Before(now) {
			continue
		}

		// keep the unexpired messages
		keep = append(keep, m)

		// make a new event to broadcast
		evt := &EventJSON{
			"global",
			m.Text,
			0,
			"",
		}

		// go through each room
		for _, room := range s.rooms {
			// go through each client connection
			for id, conn := range room.conns {
				// check to see if we've already sent this message
				// to this connection
				if m.Notified[id] {
					continue
				}
				// otherwise, send and record
				SendEvent(conn, evt)
				m.Notified[id] = true
			}
		}
	}
	// save the unexpired messages
	s.messages = keep
}

func (s *Server) MessageLoop() {
	for {
		// wait 5 seconds
		time.Sleep(5*time.Second)

		s.ReadMessages()
		s.SendMessages()
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

func EncodeSend(ws *websocket.Conn, data string) {
	encoded := base64.StdEncoding.EncodeToString([]byte(data))
	length := uint32(len(encoded))
	buf := make([]byte, 4)
	binary.LittleEndian.PutUint32(buf, length)

	ws.Write(buf)
	ws.Write([]byte(encoded))
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
			data = room.State.ToSGF(false)
		}
		EncodeSend(ws, data)
		return
	} else if op == "sgfix" {
		// basically do the same thing but include indexes
		data := ""
		if room, ok := s.rooms[roomID]; ok {
			data = room.State.ToSGF(true)
		}
		EncodeSend(ws, data)
		return
	} else if op == "debug" {
		// send debug info
		data := ""
		if room, ok := s.rooms[roomID]; ok {
	        evt := room.State.InitData("handshake")
			data,_ = evt.Value.(string)
		}
		EncodeSend(ws, data)

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
		r.lastUser = id
		s.rooms[roomID] = r
		go s.Heartbeat(roomID)
	}
    room := s.rooms[roomID]
	room.conns[id] = ws
    // defer removing the client
	defer delete(room.conns, id)

    // send initial state
    if !first {
        evt := room.State.InitData("handshake")
        if initData, err := json.Marshal(evt); err != nil {
            log.Println(id, err)
			return
        } else {
	        ws.Write(initData)
		}
    }

	// send messages
	for _, m := range s.messages {
		// make a new event to send
		evt := &EventJSON{
			"global",
			m.Text,
			0,
			"",
		}

		SendEvent(ws, evt)
		m.Notified[id] = true
	}

	// save current user
	room.nicks[id] = ""

	// send disconnection notification
	// golang deferrals are called in LIFO order
	defer room.SendUserList()
	defer delete(room.nicks, id)

	// send list of currently connected users
	room.SendUserList()

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

		// first check auth
		if evt.Event == "isprotected" {
			evt.Value = false
			if room.HasPassword() {
				evt.Value = true
			}
			data, _ := json.Marshal(evt)
			ws.Write([]byte(data))
			// don't broadcast this
			continue
		}

		if (evt.Event == "checkpassword") {
			p := evt.Value.(string)
			
			if !Authorized(p, room.password) {
				evt.Value = ""
			} else {
				room.auth[id] = true
			}
			data, _ := json.Marshal(evt)
			ws.Write([]byte(data))
			// don't broadcast this

			continue
		}

		// if the connection id isn't in the auth dictionary
		// don't accept input
		if _,ok := room.auth[id]; !ok {
			if room.password != "" {
				continue
			}
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
		//		"draw"
		// 		"update_settings"
		//		"update_nickname"
		if evt.Event != "update_settings" &&
			evt.Event != "update_nickname" &&
			evt.Event != "draw" &&
			room.lastUser != id {
			now := time.Now()
			diff := now.Sub(*room.timeLastEvent)
			if diff.Milliseconds() < room.State.InputBuffer {
				continue
			}
		}

		// handle fast users
		if evt.Event == "add_stone" {
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
			if room.OGSLink != nil {
				room.OGSLink.End()
			}

		    decoded, err := base64.StdEncoding.DecodeString(evt.Value.(string))
		    if err != nil {
		        log.Println(err)
		        continue
		    }
			evt = room.UploadSGF(string(decoded))
		} else if evt.Event == "request_sgf" {
			if room.OGSLink != nil {
				room.OGSLink.End()
			}

			url := evt.Value.(string)
			if IsOGS(url) {
				ended, err := OGSCheckEnded(url)
				if err != nil {
					log.Println(err)
				} else if !ended {
					spl := strings.Split(url, "/")
					if len(spl) < 2 {
						continue
					}
					idStr := spl[len(spl)-1]
					id64, err := strconv.ParseInt(idStr, 10, 64)
					if err != nil {
						continue
					}
					id := int(id64)
	
					o, err := NewOGSConnector(room)
					if err != nil {
						continue
					}
					go o.GameLoop(id)
					room.OGSLink = o
	
					// no need to broadcast this
					continue
				}
			}

			data, err := ApprovedFetch(evt.Value.(string))
			if err != nil {
				log.Println(err)
				newEvent := ErrorJSON(err.Error())
				data, _ := json.Marshal(newEvent)
				// broadcaste error message
				for _,conn := range room.conns {
					conn.Write(data)
				}
				continue
			}
			if data == "Permission denied" {
				newEvent := ErrorJSON("Error fetching SGF. Is it a private OGS game?")
				data, _ := json.Marshal(newEvent)
				// broadcast error message
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
			room.State = state
			evt = room.State.InitData("upload_sgf")
        } else if evt.Event == "trash" {
            // reset room
			oldBuffer := room.State.InputBuffer
            room.State = NewState(room.State.Size, true)

			// reuse old inputbuffer
			room.State.InputBuffer = oldBuffer

			if room.OGSLink != nil {
				room.OGSLink.End()
			}
		} else if evt.Event == "update_nickname" {
			nickname := evt.Value.(string)
			room.nicks[id] = nickname
			userEvt := &EventJSON {
				"connected_users",
				room.nicks,
				0,
				"",
			}
			room.Broadcast(userEvt, id, false)
		} else if evt.Event == "update_settings" {
			sMap := evt.Value.(map[string]interface{})
			buffer := int64(sMap["buffer"].(float64))
			size := int(sMap["size"].(float64))
			nickname := sMap["nickname"].(string)

			room.nicks[id] = nickname
			userEvt := &EventJSON {
				"connected_users",
				room.nicks,
				0,
				"",
			}
			room.Broadcast(userEvt, id, false)

			password := sMap["password"].(string)
			hashed := ""
			if password != "" {
				hashed = Hash(password)
			}
			settings := &Settings{buffer, size, hashed}

			room.State.InputBuffer = settings.Buffer
			if settings.Size != room.State.Size {
				// essentially trashing
				room.State = NewState(settings.Size, true)
				room.State.InputBuffer = buffer
			}

			// can be changed
			// anyone already in the room is added
			// person who set password automatically gets added
			for connID, _ := range room.conns {
				room.auth[connID] = true
			}
			room.password = hashed

		// this functionality has been absorbed into the regular url paste
		/* 
		} else if evt.Event == "link_ogs_game" {
			if room.OGSLink != nil {
				room.OGSLink.End()
			}

			url := evt.Value.(string)
			spl := strings.Split(url, "/")
			if len(spl) < 2 {
				continue
			}
			idStr := spl[len(spl)-1]
			id64, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil {
				continue
			}
			id := int(id64)

			o, err := NewOGSConnector(room)
			if err != nil {
				continue
			}
			go o.GameLoop(id)
			room.OGSLink = o

			// no need to broadcast this
			continue
		*/

		} else {
			frame, err := room.State.AddEvent(evt)
			if err != nil {
				newEvent := ErrorJSON(err.Error())
				data, _ := json.Marshal(newEvent)
				// broadcast error message
				for _, conn := range room.conns {
					conn.Write(data)
				}
                continue
			}
			if frame != nil {
				evt = &EventJSON {
					Event: "frame",
					Value: frame,
					Color: 0,
					UserID: "",
				}
			}
        }
		room.Broadcast(evt, id, true)
	}
}

func main() {
	Setup()

	cfg := websocket.Config{}

	s := NewServer()
	s.Load()
	defer s.Save()

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

	go s.MessageLoop()
	go http.ListenAndServe(url, nil)
	sig := <-cancelChan

	log.Printf("Caught signal %v", sig)
	log.Println("Shutting down gracefully")

	/*
	if err != nil {
		panic("ListenAndServe: " + err.Error())
	}
	*/
}


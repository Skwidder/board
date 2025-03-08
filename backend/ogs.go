/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

package main

import (
	"encoding/json"
	"fmt"
	"log"

	//"github.com/gorilla/websocket"
	"golang.org/x/net/websocket"
)

type User struct {
	ID int `json:"id"`
	Username string `json:"username"`
}

type Creds struct {
	User *User `json:"user"`
	JWT string `json:"user_jwt"`
}

func GetCreds() (*Creds, error) {
	url := "https://online-go.com/api/v1/ui/config"
	data, err := Fetch(url)
	if err != nil {
		return nil, err
	}
	resp := &Creds{}
	err = json.Unmarshal([]byte(data), resp)
	if err != nil {
		log.Println(err)
		return nil, err
	}
	return resp, nil
}

type OGSConnector struct {
	Creds *Creds
	Socket *websocket.Conn
	EOF bool
}

func NewOGSConnector() (*OGSConnector, error) {
	creds, err := GetCreds()
	_ = creds
	if err != nil {
		return nil, err
	}

	ws, err := websocket.Dial("wss://online-go.com/socket", "", "http://localhost")
	if err != nil {
		return nil, err
	}

	return &OGSConnector{Creds: creds, Socket: ws, EOF: false}, nil
}
func (o *OGSConnector) Send(topic string, payload map[string]interface{}) error {
	arr := []interface{}{topic, payload}
	data, err := json.Marshal(arr)
	if err != nil {
		return err
	}
	log.Println(string(data))
	o.Socket.Write(data)
	return nil
}

func (o *OGSConnector) GameConnect(gameID int) error {
	payload := make(map[string]interface{})
	payload["player_id"] = o.Creds.User.ID
	payload["chat"] = false
	payload["game_id"] = gameID
	return o.Send("game/connect", payload)
}

func (o *OGSConnector) ChatConnect() error {
	payload := make(map[string]interface{})
	payload["player_id"] = o.Creds.User.ID
	payload["username"] = o.Creds.User.Username
	payload["auth"] = o.Creds.JWT
	return o.Send("chat/connect", payload)
}

func ReadFrame(socketchan chan byte) ([]byte, error) {
	data := []byte{}
	started := false
	depth := 0
	for {
		select {
		case b := <- socketchan:
			if !started {
				if b != '[' {
					return nil, fmt.Errorf("invalid starting byte")
				}
				depth++
				data = append(data, b)
				started = true
			} else {
				if b == '[' {
					depth++
				} else if b == ']' {
					depth--
				}
				data = append(data, b)
				if depth == 0 && b == ']' {
					return data, nil
				}
			}
		}
	}
}

func (o *OGSConnector) ReadSocketToChan(socketchan chan byte) error {
	for {
		data := make([]byte, 256)
		n, _ := o.Socket.Read(data)
		for _,b := range(data[:n]) {
			socketchan <- b
		}
	}
}

func (o *OGSConnector) GameLoop(gameID int) error {
	o.ChatConnect()
	o.GameConnect(gameID)

	socketchan := make(chan byte)

	go o.ReadSocketToChan(socketchan)

	for {
		data, _ := ReadFrame(socketchan)
		arr := make([]interface{}, 2)
		err := json.Unmarshal(data, &arr)
		if err != nil {
			log.Println(err)
			continue
		}
		topic := arr[0].(string)
		payload := arr[1].(map[string]interface{})

		if topic == fmt.Sprintf("game/%d/move", gameID) {
			move := payload["move"].([]interface{})

			log.Println(move[0].(float64), move[1].(float64))
		} else if topic == fmt.Sprintf("game/%d/gamedata", gameID) {
			log.Println(payload)
		}
	}
	return nil
}

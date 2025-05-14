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
	"net/http"
	"net/url"
	"io"
	"strings"
)

func OGSCheckEnded(ogsUrl string) (bool, error) {
	ogsUrl = strings.Replace(ogsUrl, ".com", ".com/api/v1", 1)
	ogsUrl = strings.Replace(ogsUrl, "game", "games", 1)
	s, err := Fetch(ogsUrl)
	if err != nil {
		return false, err
	}

	resp := struct {Ended string `json:"ended"`}{}
	err = json.Unmarshal([]byte(s), &resp)
	if err != nil {
		return false, err
	}
	return resp.Ended != "", nil
}

func FetchOGS(ogsUrl string) (string, error) {
	ogsUrl = strings.Replace(ogsUrl, ".com", ".com/api/v1", 1)
	ogsUrl = strings.Replace(ogsUrl, "game", "games", 1)
	ogsUrl += "/sgf"
	return Fetch(ogsUrl)
}

func Fetch(urlStr string) (string, error) {
	resp, err := http.Get(urlStr)
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func IsOGS(urlStr string) bool {
	u, err := url.Parse(urlStr)
	if err != nil {
		return false
	}
	if u.Hostname() == "online-go.com" {
		return true
	}
	return false
}

func ApprovedFetch(urlStr string) (string, error) {
	okList := make(map[string]bool)
	okList["files.gokgs.com"] = true
	okList["ayd.yunguseng.com"] = true
	okList["eyd.yunguseng.com"] = true
	okList["online-go.com"] = true
	okList["gokifu.com"] = true
	okList["board.tripleko.com"] = true
	okList["board-test.tripleko.com"] = true
	okList["raw.githubusercontent.com"] = true
	u, err := url.Parse(urlStr)
	if err != nil {
		return "", err
	}
	if _,ok := okList[u.Hostname()]; !ok {
		return "", fmt.Errorf("Unapproved URL. Contact us to add %s", u.Hostname())
	}
	if u.Hostname() == "online-go.com" {
		return FetchOGS(urlStr)
	}
	return Fetch(urlStr)
}

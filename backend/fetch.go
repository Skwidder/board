package main

import (
	"fmt"
	"net/http"
	"net/url"
	"io"
	"strings"
)

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

func ApprovedFetch(urlStr string) (string, error) {
	okList := make(map[string]bool)
	okList["files.gokgs.com"] = true
	okList["ayd.yunguseng.com"] = true
	okList["eyd.yunguseng.com"] = true
	okList["online-go.com"] = true
	okList["gokifu.com"] = true
	okList["board.tripleko.com"] = true
	okList["board-test.tripleko.com"] = true
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

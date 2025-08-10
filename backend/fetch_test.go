package main_test

import (
	"testing"
	backend "github.com/jarednogo/board/backend"
)

var ogsTests = []struct {
	url string
	ogs bool
}{
	{"https://online-go.com/game/00000001", true},
	{"http://online-go.com/game/00000001", true},
	{"https://test.com/game/00000001", false},
}

func TestOGS(t *testing.T) {
	for _, tt := range ogsTests {
		t.Run(tt.url, func(t *testing.T) {
			if backend.IsOGS(tt.url) != tt.ogs {
				t.Errorf("error checking for ogs url: %s", tt.url)
			}
		})
	}
}

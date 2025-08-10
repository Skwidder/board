package main_test

import (
	"encoding/json"
	"testing"
	//backend "github.com/jarednogo/board/backend"
)

func TestGamedata(t *testing.T) {
	data := `{"white_player_id":0, "black_player_id":1, "game_name":"game", "komi":0.5, "width":19, "rules":"chinese", "initial_player":"black", "moves":[[15,15,3150],[3,15,1132],[3,3,1643],[15,3,1150]], "initial_state":{"black":"","white":""}}`

	var payload interface{}
	err := json.Unmarshal([]byte(data), &payload)
	if err != nil {
		t.Error(err)
	}
	_, ok := payload.(map[string]interface{})
	if !ok {
		t.Errorf("error while coercing interface to map[string]interface{}")
	}

	/*
	// currently no way to do tests without making network connections
	o := &backend.OGSConnector{}
	sgf := o.GamedataToSGF(gamedata)
	t.Errorf(sgf)
	*/

}

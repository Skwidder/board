package main_test

import (
	//"fmt"
	"testing"
	backend "github.com/jarednogo/board/backend"
)


func TestState1(t *testing.T) {
	s, err := backend.FromSGF("(;PW[White]RU[Japanese]KM[6.5]GM[1]FF[4]CA[UTF-8]SZ[19]PB[Black];B[pd];W[dd];B[pp];W[dp];B[];W[])")
	if err != nil {
		t.Error(err)
	}
	if s.Size != 19 {
		t.Errorf("error with state")
	}
}

func TestState2(t *testing.T) {
	input := "(;PW[White]RU[Japanese]KM[6.5]GM[1]FF[4]CA[UTF-8]SZ[19]PB[Black];B[pd];W[dd];B[pp];W[dp];B[];W[])"
	s, err := backend.FromSGF(input)
	if err != nil {
		t.Error(err)
	}

	sgf := s.ToSGF(false)
	sgfix := s.ToSGF(true)

	if len(sgf) != len(input) {
		t.Errorf("error with state to sgf, expected %d, got: %d", len(input), len(sgf))
	}

	if len(sgfix) != 132 {
		t.Errorf("error with state to sgf (indexes), expected %d, got: %d", 132, len(sgfix))
	}
}

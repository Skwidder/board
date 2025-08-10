package main_test

import (
	"fmt"
	"testing"
	backend "github.com/jarednogo/board/backend"
)

var fieldTests = []struct {
	input string
	key string
	value string
}{
	{"(;GM[1])", "GM", "1"},
	{"(;FF[4])", "FF", "4"},
	{"(;CA[UTF-8])", "CA", "UTF-8"},
	{"(;SZ[19])", "SZ", "19"},
	{"(;PB[a b])", "PB", "a b"},
	{"(;C[[1d\\]Player: \"hello world\"])", "C", "[1d]Player: \"hello world\""},
	{"(;W[aa])", "W", "aa"},
	{"(;B[])", "B", ""},
	{"(;GM [1])", "GM", "1"},
}

func TestParser(t *testing.T) {
	for _, tt := range fieldTests {
		t.Run(tt.input, func(t *testing.T) {
			p := backend.NewParser(tt.input)
			root, err := p.Parse()
			if err != nil {
				t.Error(err)
				return
			}
			if val, ok := root.Fields[tt.key]; !ok {
				t.Errorf("key not present: %s", tt.key)
			} else if len(val) != 1 {
				t.Errorf("expected length of multifield to be 1, got: %d", len(val))
			} else if val[0] != tt.value {
				t.Errorf("expected value %s, got: %s", tt.value, val[0])
			}
		})
	}
}

var outputTests = []string {
	"(;GM[1])",
	"(;GM[1];B[aa];W[bb](;B[cc];W[dd])(;B[ee];W[ff]))",
	"(;GM[1];C[some comment])",
	"(;GM[1];C[comment \"with\" quotes])",
	"(;GM[1];C[comment [with\\] brackets])",
}

func TestToSGF(t *testing.T) {
	for _,input := range outputTests {
		t.Run(input, func(t *testing.T) {
			p := backend.NewParser(input)
			root, err := p.Parse()
			if err != nil {
				t.Error(err)
				return
			}
			output := root.ToSGF(true)
			if output != input {
				t.Errorf("expected %s, got: %s", input, output)
			}
		})
	}
}

var mergeTests = []struct {
	input []string
	num int
}{
	{[]string{"(;B[aa])", "(;B[bb])"}, 2},
	{[]string{"(;AB[dd])", "(;PB[B];B[qq])", "(;GM[1](;B[aa])(;B[bb]))"}, 4},
}

func TestMerge(t *testing.T) {
	for i,tt := range mergeTests {
		t.Run(fmt.Sprintf("merge%d", i), func(t *testing.T) {
			merged := backend.Merge(tt.input)
			p := backend.NewParser(merged)
			root, err := p.Parse()
			if err != nil {
				t.Error(err)
				return
			}
			if len(root.Down) != tt.num {
				t.Errorf("expected %d children, got: %d", tt.num, len(root.Down))
				return
			}
		})
	}
}

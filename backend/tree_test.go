/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

package main_test

import (
	"testing"
	backend "github.com/jarednogo/board/backend"
)

func TestTree(t *testing.T) {
	state, err := backend.FromSGF("(;PW[White]RU[Japanese]KM[6.5]GM[1]FF[4]CA[UTF-8]SZ[19]PB[Black](;B[pd];W[dd];B[pp];W[dp])(;B[dd];W[ee]))")
	if err != nil {
		t.Error(err)
	}

	explorer := state.Root.FillGrid(0)
	m := make(map[string][2]int)

	for _, node := range explorer.Nodes {
		key := node.Coord.ToLetters()
		m[key] = [2]int{node.Coord.X, node.Coord.Y}
	}
	
	check := map[string][2]int {
		"aa": [2]int{0, 0},
		"ba": [2]int{1, 0},
		"ca": [2]int{2, 0},
		"da": [2]int{3, 0},
		"ea": [2]int{4, 0},
		"bb": [2]int{1, 1},
		"cb": [2]int{2, 1},
	}

	for key, value := range m {
		if check[key] != value {
			t.Errorf("expected %v, got: %v", check[key], value)
		}
	}
}

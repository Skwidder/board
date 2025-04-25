/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

package main

import (
    "fmt"
    "strings"
	"strconv"
    "encoding/base64"
)

type Settings struct {
	Buffer int64
	Size int
}

type Coord struct {
    X int
    Y int
}

func (c *Coord) ToLetters() string {
    alphabet := "abcdefghijklmnopqrs"
    return string([]byte{alphabet[c.X], alphabet[c.Y]})
}

func Letters2Coord(s string) *Coord {
    if len(s) != 2 {
        return nil
    }
    t := strings.ToLower(s)
    return &Coord{int(t[0]-97), int(t[1]-97)}
}

type TreeNode struct {
    XY *Coord
    Color int
    Down []*TreeNode
    Up *TreeNode
    Index int
    PreferredChild int
    Erase bool
	Fields map[string][]string
}

func NewTreeNode(coord *Coord, col, index int, up *TreeNode, erase bool, fields map[string][]string) *TreeNode {
    down := []*TreeNode{}
    return &TreeNode{coord, col, down, up, index, 0, erase, fields}
}

// as a rule, anything that would need to get sent to new connections
// should be stored here and not in the Room struct
type State struct {
    Root *TreeNode
    Current *TreeNode
	Head *TreeNode
    Nodes map[int]*TreeNode
    NextIndex int
	InputBuffer int64
	Timeout float64
	Size int
}

func (s *State) Prefs() string {
    result := "{"
    first := true
    stack := []*TreeNode{s.Root}
    for len(stack) > 0 {
        i := len(stack) - 1
        cur := stack[i]
        stack = stack[:i]

        c := cur.PreferredChild
        if first {
            result = fmt.Sprintf("%s\"%d\":%d", result, cur.Index, c)
            first = false
        } else {
            result = fmt.Sprintf("%s,\"%d\":%d", result, cur.Index, c)
        }

        if len(cur.Down) == 1 {
            stack = append(stack, cur.Down[0])
        } else if len(cur.Down) > 1 {
            // go backward through array
            for i:=len(cur.Down)-1; i >= 0; i-- {
                n := cur.Down[i]
                stack = append(stack, n)
            }
        }
    }

    result += "}"
    return result
}

func (s *State) SetPreferred(index int) error {
    n := s.Nodes[index]
    cur := n
    for {
		if cur == nil {
			return fmt.Errorf("Error in indexing")
		}
        if cur.Up == nil {
            break;
        }
        oldIndex := cur.Index
        cur = cur.Up
        for i,d := range(cur.Down) {
            if d.Index == oldIndex {
                cur.PreferredChild = i
            }
        }
    }
	return nil
}

func (s *State) ResetPrefs() {
    stack := []*TreeNode{s.Root}
    for len(stack) > 0 {
        i := len(stack) - 1
        cur := stack[i]
        stack = stack[:i]

		cur.PreferredChild = 0

        if len(cur.Down) == 1 {
            stack = append(stack, cur.Down[0])
        } else if len(cur.Down) > 1 {
            // go backward through array
            for i:=len(cur.Down)-1; i >= 0; i-- {
                n := cur.Down[i]
                stack = append(stack, n)
            }
        }
	}
}

func (s *State) SetPrefs(prefs map[string]int) {
    stack := []*TreeNode{s.Root}
    for len(stack) > 0 {
        i := len(stack) - 1
        cur := stack[i]
        stack = stack[:i]

		key := fmt.Sprintf("%d", cur.Index)
		p := prefs[key]

		cur.PreferredChild = p

        if len(cur.Down) == 1 {
            stack = append(stack, cur.Down[0])
        } else if len(cur.Down) > 1 {
            // go backward through array
            for i:=len(cur.Down)-1; i >= 0; i-- {
                n := cur.Down[i]
                stack = append(stack, n)
            }
        }
	}
}


func (s *State) Locate() string {
    dirs := []int{}
    c := s.Current
    for {
        myIndex := c.Index
        if c.Up == nil {
            break
        }
        u := c.Up
        for i:=0; i < len(u.Down); i++ {
            if u.Down[i].Index == myIndex {
                dirs = append(dirs, i)
            }
        }
        c = u
    }
    result := ""
    firstComma := false
    for i:=len(dirs)-1; i>=0; i-- {
        d := dirs[i]
        if !firstComma {
            result = fmt.Sprintf("%d", d)
            firstComma = true
        } else {
            result = fmt.Sprintf("%s,%d", result, d)
        }
    }
    return result
}

func (s *State) GetNextIndex() int {
    i := s.NextIndex
    s.NextIndex++
    return i
}

func (s *State) AddFieldNode(fields map[string][]string, index int) {
	tmp := s.GetNextIndex()
	if index == -1 {
		index = tmp
	}
	n := NewTreeNode(nil, -1, index, s.Current, false, fields)
	s.Nodes[index] = n
	if s.Root == nil {
		s.Root = n
	} else {
		s.Current.Down = append(s.Current.Down, n)
		s.Current.PreferredChild = len(s.Current.Down) - 1
	}
	s.Current = n
}

func (s *State) AddPassNode(col int, fields map[string][]string, index int) {
	tmp := s.GetNextIndex()
	if index == -1 {
    	index = tmp
	}
    n := NewTreeNode(nil, col, index, s.Current, false, fields)
    s.Nodes[index] = n
	if s.Root == nil {
		s.Root = n
	} else {
	    s.Current.Down = append(s.Current.Down, n)
	    s.Current.PreferredChild = len(s.Current.Down) - 1
	}
	s.Current = n
}

func (s *State) PushHead(x, y, col int) {
	coord := &Coord{x, y}
	if x == -1 || y == -1 {
		coord = nil
	}
	index := s.GetNextIndex()
    n := NewTreeNode(coord, col, index, s.Head, false, nil)
	s.Nodes[index] = n
	if len(s.Head.Down) > 0 {
		s.Head.PreferredChild++
	}
	s.Head.Down = append([]*TreeNode{n}, s.Head.Down...)

	if s.Current == s.Head {
		// follow along if we're at the head
		s.Current = n
	}
	s.Head = n
}

func (s *State) AddNode(x, y, col int, erase bool, fields map[string][]string, index int) {
    coord := &Coord{x, y}
	// check to see if it's already there
	for i,node := range(s.Current.Down) {
		coord_old := node.XY
		if coord_old != nil && coord != nil && coord_old.X == x && coord_old.Y == y && node.Color == col {
			s.Current.PreferredChild = i
			s.Right()
			return
		}
	}

	tmp := s.GetNextIndex()
	if index == -1 {
	    index = tmp
	}
    n := NewTreeNode(coord, col, index, s.Current, erase, fields)

    s.Nodes[index] = n
	if s.Root == nil {
		s.Root = n
	} else {
	    s.Current.Down = append(s.Current.Down, n)
	    s.Current.PreferredChild = len(s.Current.Down) - 1
	}
	s.Current = n
}

func (s *State) Cut(index int) {
	s.Left()
	j := -1
	for i:=0; i < len(s.Current.Down); i++ {
		node := s.Current.Down[i]
		if node.Index == index {
			j = i
			break
		}
	}
	delete(s.Nodes, index)
	if j == -1 {
		return
	}
	s.Current.Down = append(s.Current.Down[:j], s.Current.Down[j+1:]...)

	// adjust prefs
	if (s.Current.PreferredChild >= len(s.Current.Down)) {
		s.Current.PreferredChild = 0
	}
}

func (s *State) Left() {
    if s.Current.Up != nil {
        s.Current = s.Current.Up
    }
}

func (s *State) Right() {
    if len(s.Current.Down) > 0 {
        index := s.Current.PreferredChild
        s.Current = s.Current.Down[index]
    }
}

func (s *State) Up() {
    if len(s.Current.Down) == 0 {
        return
    }
    c := s.Current.PreferredChild
    mod := len(s.Current.Down)
    s.Current.PreferredChild = (((c-1) % mod) + mod) % mod
}

func (s *State) Down() {
    if len(s.Current.Down) == 0 {
        return
    }
    c := s.Current.PreferredChild
    mod := len(s.Current.Down)
    s.Current.PreferredChild = (((c+1) % mod) + mod) % mod
}

func (s *State) GotoCoord(x, y int) {
	cur := s.Current
	// look forward
	for {
		if (cur.XY != nil && cur.XY.X == x && cur.XY.Y == y) {
			s.Current = cur
			return
		}
		if len(cur.Down) == 0 {
			break
		}
		cur = cur.Down[cur.PreferredChild]
	}

	cur = s.Current
	// look backward
	for {
		if (cur.XY != nil && cur.XY.X == x && cur.XY.Y == y) {
			s.Current = cur
			return
		}
		if cur.Up == nil {
			break
		}
		cur = cur.Up
	}
}

func (s *State) Add(evt *EventJSON) error {
	if evt.Event == "stone-toggle" {
        coords := make([]int, 0)
        // coerce the value to an array
        val := evt.Value.([]interface{})
        for _,v := range val {
            i := int(v.(float64))
            coords = append(coords, i)
        }
        x := coords[0]
        y := coords[1]
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }

        s.AddNode(x, y, evt.Color, false, nil, -1)

	} else if evt.Event == "stone-manual" {
        coords := make([]int, 0)
        // coerce the value to an array
        val := evt.Value.([]interface{})
        for _,v := range val {
            i := int(v.(float64))
            coords = append(coords, i)
        }
        x := coords[0]
        y := coords[1]
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }

		// i suppose this is kind of opinionated
		// but for now manual stone placements are going to
		// be interpreted the same as toggled placements
		s.AddNode(x, y, evt.Color, false, nil, -1)

		/*
		fields := make(map[string][]string)
		key := "AB"
		if evt.Color == 2 {
			key = "AW"
		}
    	coord := &Coord{x, y}
		fields[key] = []string{coord.ToLetters()}
		s.AddFieldNode(fields)
		*/
	} else if evt.Event == "pass" {
		fields := make(map[string][]string)
		s.AddPassNode(evt.Color, fields, -1)
	} else if evt.Event == "mark" {
        coords := make([]int, 0)
        // coerce the value to an array
        val := evt.Value.([]interface{})
        for _,v := range val {
            i := int(v.(float64))
            coords = append(coords, i)
        }
        x := coords[0]
        y := coords[1]
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }

        if evt.Mark == "eraser" {
            s.AddNode(x, y, 0, true, nil, -1)
        }

	} else if evt.Event == "scissors" {
        index := int(evt.Value.(float64))
		if index == 0 {
			return nil
		}
		s.Cut(index)

    } else if evt.Event == "keydown" {
        // coerce the value to a string
        val := evt.Value.(string)
        if val == "ArrowLeft" {
            s.Left()
        } else if val == "ArrowRight" {
            s.Right()
        } else if val == "ArrowUp" {
            s.Up()
        } else if val == "ArrowDown" {
            s.Down()
        }
    } else if evt.Event == "button" {
        val := evt.Value.(string)
        if val == "Rewind" {
            s.Current = s.Root
        } else if val == "FastForward" {
            for {
                if len(s.Current.Down) == 0 {
                    break
                }
                index := s.Current.PreferredChild
                s.Current = s.Current.Down[index]
            }
        }
    } else if evt.Event == "goto_grid" {
        index := int(evt.Value.(float64))
		err := s.SetPreferred(index)
		if err != nil {
			return err
		}
        s.Current = s.Nodes[index]
	} else if evt.Event == "goto_coord" {
        coords := make([]int, 0)
        // coerce the value to an array
        val := evt.Value.([]interface{})
        for _,v := range val {
            i := int(v.(float64))
            coords = append(coords, i)
        }
        x := coords[0]
        y := coords[1]
		s.GotoCoord(x, y)
    } else if evt.Event == "update_buffer" {
		// if there's an update to input buffer, save it
    	val := int64(evt.Value.(float64))
		s.InputBuffer = val
	}
	return nil
}

func (s *State) ToSGF(indexes bool) string {
    result := "("
    stack := []*StackTreeNode{&StackTreeNode{"node", s.Root, ""}};
    for len(stack) > 0 {
        i := len(stack) - 1
        cur := stack[i]
        stack = stack[:i]
        if cur.Type == "string" {
            result += cur.StringValue
            continue
        }
        node := cur.NodeValue
        result += ";"
        if node.Erase {
			result += fmt.Sprintf("AE[%s]", node.XY.ToLetters())
        } else if node.Color > 0 {
			color := "B"
            if node.Color == 2 {
				color = "W"
            }
			if node.XY != nil {
				result += fmt.Sprintf("%s[%s]", color, node.XY.ToLetters())
			} else {
				result += fmt.Sprintf("%s[]", color)
			}
        }
		// throw in other fields
		for key, multifield := range(node.Fields) {
			if key == "IX" {
				continue
			}
			result += fmt.Sprintf("%s", key)
			for _,fieldValue := range(multifield) {
				m := strings.ReplaceAll(fieldValue, "]", "\\]")
				result += fmt.Sprintf("[%s]", m)
			}

		}

		if indexes {
        	result += fmt.Sprintf("IX[%d]", node.Index)
		}

        if len(node.Down) == 1 {
            stack = append(stack, &StackTreeNode{"node", node.Down[0], ""})
        } else if len(node.Down) > 1 {
            // go backward through array
            for i:=len(node.Down)-1; i >= 0; i-- {
                n := node.Down[i]
                stack = append(stack, &StackTreeNode{"string", nil, ")"})
                stack = append(stack, &StackTreeNode{"node", n, ""})
                stack = append(stack, &StackTreeNode{"string", nil, "("})
            }
        }
    }

    result += ")"
	encoded := base64.StdEncoding.EncodeToString([]byte(result))
    return encoded
}

func FromSGF(data string) (*State, error) {
    p := NewParser(data)
    root, err := p.Parse()
    if err != nil {
        return nil, err
    }

	var size int64 = 19
	if _,ok := root.Fields["SZ"]; ok {
		size_field := root.Fields["SZ"]
		if len(size_field) != 1 {
			return nil, fmt.Errorf("SZ cannot be a multifield")
		}
		size, err = strconv.ParseInt(size_field[0], 10, 64)
		if err != nil {
			return nil, err
		}
	}

    state := NewState(int(size), false)
    stack := []*StackSGFNode{&StackSGFNode{"node", root, ""}}
    for len(stack) > 0 {
        i := len(stack) - 1
        cur := stack[i]
        stack = stack[:i]
        if cur.Type == "string" {
            if cur.StringValue == "<" {
                state.Left()
            }
        } else {
            node := cur.NodeValue
            v := node.Value
            col := node.Color

			index := -1
			if indexes, ok := node.Fields["IX"]; ok {
				if len(indexes) > 0 {
					_index, err := strconv.ParseInt(indexes[0], 10, 64)
					index = int(_index)
					if err != nil {
						index = -1
					}
				}
			}

            if col != 0 && v != nil {
                state.AddNode(v.X, v.Y, col, false, node.Fields, index)
            } else if col != 0 {
				state.AddPassNode(col, node.Fields, index)
			} else {
				state.AddFieldNode(node.Fields, index)
			}
            for i:=len(node.Down)-1; i>=0; i-- {
                stack = append(stack, &StackSGFNode{"string", nil, "<"})
                stack = append(stack, &StackSGFNode{"node", node.Down[i], ""})
            }
			state.Head = state.Current
        }
    }
    state.Current = state.Root
	state.ResetPrefs()
    return state, nil
}

func (s *State) InitData(event string) *EventJSON {
    sgf := s.ToSGF(true)
    loc := s.Locate()
    prefs := s.Prefs()
	value := fmt.Sprintf("{\"sgf\":\"%s\", \"loc\":\"%s\", \"prefs\":%s, \"buffer\":%d, \"next_index\":%d}", sgf, loc, prefs, s.InputBuffer, s.NextIndex)
	evt := &EventJSON{event, value, 0, "", ""}
	return evt
    
    //return []byte(fmt.Sprintf("{\"event\":\"%s\",\"value\":%s}", event, value))
 
}

func NewState(size int, initRoot bool) *State {
    nodes := make(map[int]*TreeNode)
	var root *TreeNode
	root = nil
	index := 0
	if initRoot {
		fields := map[string][]string{}
		fields["GM"] = []string{"1"}
		fields["FF"] = []string{"4"}
		fields["CA"] = []string{"UTF-8"}
		fields["SZ"] = []string{fmt.Sprintf("%d", size)}
		fields["PB"] = []string{"Black"}
		fields["PW"] = []string{"White"}
		fields["RU"] = []string{"Japanese"}
		fields["KM"] = []string{"6.5"}
	
	    // coord, color, index, up, erase, fields
	    root = NewTreeNode(nil, 0, 0, nil, false, fields)
    	nodes[0] = root
		index = 1
	}
	// default input buffer of 250
	// default room timeout of 86400
    return &State{root, root, root, nodes, index, 250, 86400, size}
}

type StackTreeNode struct {
    Type string
    NodeValue *TreeNode
    StringValue string
}

type StackSGFNode struct {
    Type string
    NodeValue *SGFNode
    StringValue string
}


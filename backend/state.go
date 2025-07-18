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

const Letters = "ABCDEFGHIJKLNMOPQRSTUVWXYZ"

type Settings struct {
	Buffer int64
	Size int
	Password string
}

type Coord struct {
    X int
    Y int
}

func (c *Coord) ToLetters() string {
    alphabet := "abcdefghijklmnopqrs"
    return string([]byte{alphabet[c.X], alphabet[c.Y]})
}

func LettersToCoord(s string) *Coord {
    if len(s) != 2 {
        return nil
    }
    t := strings.ToLower(s)
    return &Coord{int(t[0]-97), int(t[1]-97)}
}

func InterfaceToCoord(ifc interface{}) (*Coord, error) {
    coords := make([]int, 0)

    // coerce the value to an array
    val, ok := ifc.([]interface{})

	if !ok {
		return nil, fmt.Errorf("error coercing to coord")
	}

    for _,v := range val {
        i := int(v.(float64))
        coords = append(coords, i)
    }
    x := coords[0]
    y := coords[1]
	return &Coord{x, y}, nil

}

type TreeNode struct {
    XY *Coord
    Color int
    Down []*TreeNode
    Up *TreeNode
    Index int
    PreferredChild int
	Fields map[string][]string
	Diff *Diff
}

func NewTreeNode(coord *Coord, col, index int, up *TreeNode, fields map[string][]string) *TreeNode {
	if fields == nil {
		fields = make(map[string][]string)
	}
    down := []*TreeNode{}
    return &TreeNode{coord, col, down, up, index, 0, fields, nil}
}

func (n *TreeNode) AddField(key, value string) {
	if _, ok := n.Fields[key]; !ok {
		n.Fields[key] = []string{}
	}
	n.Fields[key] = append(n.Fields[key], value)
}

func (n *TreeNode) RemoveField(key, value string) {
	if _, ok := n.Fields[key]; !ok {
		return
	}
	index := -1
	for i, v := range n.Fields[key] {
		if v == value {
			index = i
		}
	}
	if index == - 1 {
		return
	}
	n.Fields[key] = append(n.Fields[key][:index], n.Fields[key][index+1:]...)
	if len(n.Fields[key]) == 0 {
		delete(n.Fields, key)
	}
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
	Board *Board
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
	n := NewTreeNode(nil, -1, index, s.Current, fields)
	s.Nodes[index] = n
	if s.Root == nil {
		s.Root = n
	} else {
		s.Current.Down = append(s.Current.Down, n)
		s.Current.PreferredChild = len(s.Current.Down) - 1
	}
	s.Current = n

	// compute diff
	diffAdd := []*StoneSet{}
	if val, ok := fields["AB"]; ok {
		add := NewCoordSet()
		for _,v := range val {
			add.Add(LettersToCoord(v))
		}
		stoneSet := NewStoneSet(add, Black)
		diffAdd = append(diffAdd, stoneSet)
	}

	if val, ok := fields["AW"]; ok {
		add := NewCoordSet()
		for _,v := range val {
			add.Add(LettersToCoord(v))
		}
		stoneSet := NewStoneSet(add, White)
		diffAdd = append(diffAdd, stoneSet)
	}

	diffRemove := []*StoneSet{}
	if val, ok := fields["AE"]; ok {
		csBlack := NewCoordSet()
		csWhite := NewCoordSet()
		for _,v := range val {
			coord := LettersToCoord(v)
			col := s.Board.Get(coord)
			if col == Black {
				csBlack.Add(coord)
			} else if col == White {
				csWhite.Add(coord)
			}
		}
		removeBlack := NewStoneSet(csBlack, Black)
		removeWhite := NewStoneSet(csWhite, White)
		diffRemove = append(diffRemove, removeBlack)
		diffRemove = append(diffRemove, removeWhite)
	}

	diff := NewDiff(diffAdd, diffRemove)
	s.Board.ApplyDiff(diff)
	s.Current.Diff = diff
}

func (s *State) AddPassNode(col int, fields map[string][]string, index int) {
	tmp := s.GetNextIndex()
	if index == -1 {
    	index = tmp
	}
    n := NewTreeNode(nil, col, index, s.Current, fields)
    s.Nodes[index] = n
	if s.Root == nil {
		s.Root = n
	} else {
	    s.Current.Down = append(s.Current.Down, n)
	    s.Current.PreferredChild = len(s.Current.Down) - 1
	}
	s.Current = n
	// no need to add a diff
}

func (s *State) PushHead(x, y, col int) {
	coord := &Coord{x, y}
	if x == -1 || y == -1 {
		coord = nil
	}
	index := s.GetNextIndex()
    n := NewTreeNode(coord, col, index, s.Head, nil)
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
	// TODO: need to compute diff
}

func (s *State) AddNode(x, y, col int, fields map[string][]string, index int, force bool) {
	if fields == nil {
		fields = make(map[string][]string)
	}
    coord := &Coord{x, y}
	if !force {
		// check to see if it's already there
		for i,node := range(s.Current.Down) {
			coord_old := node.XY
			if coord_old != nil && coord != nil && coord_old.X == x && coord_old.Y == y && node.Color == col {
				s.Current.PreferredChild = i
				s.Right()
				return
			}
		}
	}

	tmp := s.GetNextIndex()
	if index == -1 {
	    index = tmp
	}
    n := NewTreeNode(coord, col, index, s.Current, fields)

    s.Nodes[index] = n
	if s.Root == nil {
		s.Root = n
	} else {
	    s.Current.Down = append(s.Current.Down, n)
	    s.Current.PreferredChild = len(s.Current.Down) - 1
	}
	s.Current = n
	diff := s.Board.Move(coord, Color(col))
	s.Current.Diff = diff
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
		s.Board.ApplyDiff(s.Current.Diff.Invert())
        s.Current = s.Current.Up
    }
}

func (s *State) Right() {
    if len(s.Current.Down) > 0 {
        index := s.Current.PreferredChild
        s.Current = s.Current.Down[index]
		s.Board.ApplyDiff(s.Current.Diff)
    }
}

func (s *State) GotoIndex(index int) error {
	err := s.SetPreferred(index)
	if err != nil {
		return err
	}
	s.Rewind()
	for {
		if s.Current.Index == index {
			break
		}
		s.Right()
	}
    //s.Current = s.Nodes[index]
	return nil
}

func (s *State) Rewind() {
	s.Current = s.Root
	s.Board.Clear()
	s.Board.ApplyDiff(s.Current.Diff)
}

func (s *State) FastForward() {
	for {
	    if len(s.Current.Down) == 0 {
	        break
	    }
		s.Right()
		/*
	    index := s.Current.PreferredChild
	    s.Current = s.Current.Down[index]
		*/
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
	switch evt.Event {
	case "add_stone":
		c, err := InterfaceToCoord(evt.Value)
		if err != nil {
			return err
		}
		/*
        coords := make([]int, 0)
        // coerce the value to an array
        val := evt.Value.([]interface{})
        for _,v := range val {
            i := int(v.(float64))
            coords = append(coords, i)
        }
		*/
        x := c.X
        y := c.Y
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }

        s.AddNode(x, y, evt.Color, nil, -1, false)
	case "pass":
		fields := make(map[string][]string)
		s.AddPassNode(evt.Color, fields, -1)
	case "remove_stone":
		c, err := InterfaceToCoord(evt.Value)
		if err != nil {
			return err
		}

        x := c.X
        y := c.Y
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }

		fields := make(map[string][]string)
		fields["AE"] = []string{c.ToLetters()}
		s.AddFieldNode(fields, -1)
	case "triangle":
		c, err := InterfaceToCoord(evt.Value)
		if err != nil {
			return err
		}

        x := c.X
        y := c.Y
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }
		l := c.ToLetters()
		s.Current.AddField("TR", l)

	case "square":
		c, err := InterfaceToCoord(evt.Value)
		if err != nil {
			return err
		}

	    x := c.X
        y := c.Y
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }
		l := c.ToLetters()
		s.Current.AddField("SQ", l)

	case "letter":
		val := evt.Value.(map[string]interface{})
		c, err := InterfaceToCoord(val["coords"])
		if err != nil {
			return err
		}

	    x := c.X
        y := c.Y
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }

		l := c.ToLetters()
		letter := val["letter"].(string)
		lb := fmt.Sprintf("%s:%s", l, letter)
		s.Current.AddField("LB", lb)

	case "number":
		val := evt.Value.(map[string]interface{})
		c, err := InterfaceToCoord(val["coords"])
		if err != nil {
			return err
		}

	    x := c.X
        y := c.Y
        if x >= s.Size || y >= s.Size || x < 0 || y < 0 {
            return nil
        }

		l := c.ToLetters()
		number := int(val["number"].(float64))
		lb := fmt.Sprintf("%s:%d", l, number)
		s.Current.AddField("LB", lb)
	
	case "remove_mark":
		c, err := InterfaceToCoord(evt.Value)
		if err != nil {
			return err
		}

		l := c.ToLetters()
		for key, values := range s.Current.Fields {
			for _, value := range values {
				if key == "LB" && value[:2] == l {
					s.Current.RemoveField("LB", value)
				} else if key == "SQ" && value == l {
					s.Current.RemoveField("SQ", l)
				} else if key == "TR" && value == l {
					s.Current.RemoveField("TR", l)
				}
			}
		}
	
	case "scissors":
        index := int(evt.Value.(float64))
		if index == 0 {
			return nil
		}
		s.Cut(index)

	case "keydown":
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
	case "button":
        val := evt.Value.(string)
        if val == "Rewind" {
			s.Rewind()
            //s.Current = s.Root
        } else if val == "FastForward" {
			s.FastForward()
			/*
            for {
                if len(s.Current.Down) == 0 {
                    break
                }
                index := s.Current.PreferredChild
                s.Current = s.Current.Down[index]
            }
			*/
        }
	case "goto_grid":
        index := int(evt.Value.(float64))
		s.GotoIndex(index)
		/*
		err := s.SetPreferred(index)
		if err != nil {
			return err
		}
        s.Current = s.Nodes[index]
		*/
	case "goto_coord":
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
	case "update_buffer":
		// if there's an update to input buffer, save it
    	val := int64(evt.Value.(float64))
		s.InputBuffer = val
	case "comment":
		val := evt.Value.(string)
		s.Current.AddField("C", val + "\n")
	case "draw":
		vals := evt.Value.([]interface{})
		var x0 float64
		var y0 float64
		if vals[0] == nil {
			x0 = -1.0
		} else {
			x0 = vals[0].(float64)
		}
	
		if vals[1] == nil {
			y0 = -1.0
		} else {
			y0 = vals[1].(float64)
		}

		x1 := vals[2].(float64)
		y1 := vals[3].(float64)
		color := vals[4].(string)

		value := fmt.Sprintf("%.4f:%.4f:%.4f:%.4f:%s", x0, y0, x1, y1, color)
		s.Current.AddField("PX", value)
	case "erase_pen":
		delete(s.Current.Fields, "PX")
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
        if node.Color > 0 {
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
	return result
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
                state.AddNode(v.X, v.Y, col, node.Fields, index, true)
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
	state.Rewind()
	state.ResetPrefs()
    return state, nil
}

func (s *State) InitData(event string) *EventJSON {
    sgf := s.ToSGF(true)
	encoded := base64.StdEncoding.EncodeToString([]byte(sgf))
    loc := s.Locate()
    prefs := s.Prefs()
	value := fmt.Sprintf("{\"sgf\":\"%s\", \"loc\":\"%s\", \"prefs\":%s, \"buffer\":%d, \"next_index\":%d}", encoded, loc, prefs, s.InputBuffer, s.NextIndex)
	evt := &EventJSON{event, value, 0, ""}
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
	
	    // coord, color, index, up, fields
	    root = NewTreeNode(nil, 0, 0, nil, fields)
    	nodes[0] = root
		index = 1
	}
	board := NewBoard(size)
	// default input buffer of 250
	// default room timeout of 86400
    return &State{root, root, root, nodes, index, 250, 86400, size, board}
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


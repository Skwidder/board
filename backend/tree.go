/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

package main

type TreeNode struct {
	XY             *Coord
	Color          Color
	Down           []*TreeNode
	Up             *TreeNode
	Index          int
	PreferredChild int
	Fields         map[string][]string
	Diff           *Diff
}

func NewTreeNode(coord *Coord, col Color, index int, up *TreeNode, fields map[string][]string) *TreeNode {
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
	if index == -1 {
		return
	}
	n.Fields[key] = append(n.Fields[key][:index], n.Fields[key][index+1:]...)
	if len(n.Fields[key]) == 0 {
		delete(n.Fields, key)
	}
}

func (n *TreeNode) FillGrid(currentIndex int) *Explorer {
	stack := []interface{}{n}
	x := 0
	y := 0
	gridLen := 1
	grid := make(map[[2]int]int)
	loc := make(map[int][2]int)
	colors := make(map[int]Color)
	parents := make(map[int]int)
	prefs := make(map[int]int)
	var currentCoord *Coord
	var currentColor Color
	for len(stack) > 0 {
		// pop off the stack
		cur := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		if _, ok := cur.(string); ok {
			x--
			continue
		}

		node := cur.(*TreeNode)
		colors[node.Index] = node.Color
		if node.Up != nil {
			parents[node.Index] = node.Up.Index
		}
		if len(node.Down) > 0 {
			prefs[node.Index] = node.Down[node.PreferredChild].Index
		}

		y = gridLen - 1

		if grid[[2]int{y, x}] != 0 {
			// if there's something in the last row (in the x coord)
			// add a new row
			gridLen++
			y++
		} else {
			for y != 0 {

				// look at the parent
				p := node.Up
				if p != nil {
					a := loc[p.Index]
					x1 := a[0]
					y1 := a[1]
					// actually don't go any farther than the
					// diagonal connecting the parent
					if x-y >= x1-y1 {
						break
					}

					// don't go any farther than the parent row
					if y == y1 {
						break
					}
				}

				// i want to find the earliest row
				// (before going past the parent)
				// that is empty
				if grid[[2]int{y, x}] == 0 && grid[[2]int{y - 1, x}] != 0 {
					break
				}
				y--
			}
		}
		grid[[2]int{y, x}] = node.Index
		loc[node.Index] = [2]int{x, y}

		if node.Index == currentIndex {
			currentCoord = &Coord{x, y}
			currentColor = node.Color
		}

		// if the parent is a diagonal away, we have to take up
		// another node
		// (this is for all the "angled" edges")
		p := node.Up
		if p != nil {
			a := loc[p.Index]
			y1 := a[1]
			if y-y1 > 1 {
				if grid[[2]int{y - 1, x - 1}] == 0 {
					grid[[2]int{y - 1, x - 1}] = -1
				}
			}
		}
		x++

		// push on children in reverse order
		for i := len(node.Down) - 1; i >= 0; i-- {
			stack = append(stack, "")
			stack = append(stack, node.Down[i])
		}
	}

	nodes := []*GridNode{}
	edges := []*GridEdge{}
	for i, l := range loc {
		// gather all the nodes with their color attached
		x := l[0]
		y := l[1]
		gridNode := &GridNode{&Coord{x, y}, colors[i], i}
		nodes = append(nodes, gridNode)

		// gather all the edges
		p, ok := parents[i]
		if !ok {
			continue
		}
		pCoord := loc[p]
		start := &Coord{pCoord[0], pCoord[1]}
		end := &Coord{x, y}
		edge := &GridEdge{start, end}
		edges = append(edges, edge)
	}

	preferredNodes := []*GridNode{}
	index := 0
	for {
		if l, ok := loc[index]; ok {
			x := l[0]
			y := l[1]
			gridNode := &GridNode{&Coord{x, y}, colors[index], index}
			preferredNodes = append(preferredNodes, gridNode)

			if index, ok = prefs[index]; !ok {
				break
			}

		} else {
			break
		}
	}

	return &Explorer{
		nodes,
		edges,
		preferredNodes,
		currentCoord,
		currentColor,
	}
}

type GridNode struct {
	Coord *Coord `json:"coord"`
	Color `json:"color"`
	Index int `json:"index"`
}

type GridEdge struct {
	Start *Coord `json:"start"`
	End   *Coord `json:"end"`
}

type Explorer struct {
	Nodes          []*GridNode `json:"nodes"`
	Edges          []*GridEdge `json:"edges"`
	PreferredNodes []*GridNode `json:"preferred_nodes"`
	Current        *Coord      `json:"current"`
	CurrentColor   Color       `json:"current_color"`
}

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
)

type Expr struct {
    Type string
    Value interface{}
}

func IsWhitespace(c byte) bool {
    return c == '\n' || c == ' ' || c == '\t' || c == '\r'
}

type SGFNode struct {
    Value *Coord
    Color int
    Labels map[string]string
    Triangles []string
    Fields map[string][]string
    Down []*SGFNode
    Index int
}

func NewSGFNode(v *Coord, color int, labels map[string]string, triangles []string, fields map[string][]string, index int) *SGFNode {
    return &SGFNode{v, color, labels, triangles, fields, []*SGFNode{}, index}
}

type Parser struct {
    Text string
    Index int
}

func NewParser(text string) *Parser {
    return &Parser{text, 0}
}

func (p *Parser) Parse() (*SGFNode, error) {
    p.SkipWhitespace()
    c := p.read()
    if c == '(' {
        return p.ParseBranch()
    } else {
        return nil, fmt.Errorf("unexpected %c", c)
    }
}

func (p *Parser) SkipWhitespace() *Expr {
    for {
        if IsWhitespace(p.peek(0)) {
            p.read()
        } else {
            break
        }
    }
    return &Expr{"whitespace", ""}
}

func (p *Parser) ParseKey() (string, error) {
    s := ""
    for {
        c := p.peek(0)
        if c == 0 {
            return "", fmt.Errorf("bad key")
        } else if c < 'A' || c > 'Z' {
            break
        }
        s += string([]byte{p.read()})
    }
    return s, nil
}

func (p *Parser) ParseField() (string, error) {
    s := ""
    for {
        t := p.read()
        if t == 0 {
            return "", fmt.Errorf("bad field")
        } else if t == ']' {
            break
        } else if t == '\\' && p.peek(0) == ']' {
            t = p.read()
        }
        s = fmt.Sprintf("%s%c", s, t)
    }
    return s, nil
}

func (p *Parser) ParseNodes() ([]*SGFNode, error) {
    n, err := p.ParseNode()
    if err != nil {
        return nil, err
    }
    root := n
    cur := root
    for {
        c := p.peek(0)
        if c == ';' {
            p.read()
            next, err := p.ParseNode()
            if err != nil {
                return nil, err
            }
            cur.Down = append(cur.Down, next)
            cur = next
        } else {
            break
        }
    }
    return []*SGFNode{root, cur}, nil
}

func (p *Parser) ParseNode() (*SGFNode, error) {
    fields := make(map[string][]string)
    labels := make(map[string]string)
    triangles := []string{}
    color := 0
    move := ""
    index := 0
    for {
        p.SkipWhitespace()
        c := p.peek(0)
        if c == '(' || c == ';' || c == ')' {
            break
        }
        if c < 'A' || c > 'Z' {
            return nil, fmt.Errorf("bad node (expected key) %c", c)
        }
        key, err := p.ParseKey()
        if err != nil {
            return nil, err
        }
        multifield := []string{};
        p.SkipWhitespace()
        if p.read() != '[' {
            return nil, fmt.Errorf("bad node (expected field) %c", c)
        }
        field, err := p.ParseField()
        if err != nil {
            return nil, err
        }
        multifield = append(multifield, field)

        for {
            p.SkipWhitespace()
            if p.peek(0) == '[' {
                p.read()
                field, err = p.ParseField()
                if err != nil {
                    return nil, err
                }
                multifield = append(multifield, field)
            } else {
                break
            }
        }

        p.SkipWhitespace()
        switch key {
        case "TR":
            for _,f := range(multifield) {
                triangles = append(triangles, f)
            }
        case "LB":
            for _,f := range(multifield) {
                spl := strings.Split(f, ":")
                if len(spl) != 2 {
                    continue
                }
                labels[spl[0]] = spl[1]
            }
        case "B":
            color = 1
            move = multifield[0]
        case "W":
            color = 2
            move = multifield[0]
        default:
            fields[key] = multifield
        }
    }

    v := Letters2Coord(move)
    n := NewSGFNode(v, color, labels, triangles, fields, index)
    return n, nil
}

func (p *Parser) ParseBranch() (*SGFNode, error) {
    var root *SGFNode
    var current *SGFNode
    for {
        c := p.read()
        if c == 0 {
            return nil, fmt.Errorf("unfinished branch, expected ')'")
        } else if c == ';' {
            nodes, err := p.ParseNodes()
            if err != nil {
                return nil, err
            }
            node := nodes[0]
            cur := nodes[1]
            if root == nil {
                root = node
                current = cur
            } else {
                current.Down = append(current.Down, node)
                current = cur
            }
        } else if c == '(' {
            newBranch, err := p.ParseBranch()
            if err != nil {
                return nil, err
            }

            if root == nil {
                root = newBranch
                current = newBranch
            } else {
                current.Down = append(current.Down, newBranch)
            }
        } else if c == ')' {
            break
        }
    }
    return root, nil
}

func (p *Parser) read() byte {
    if p.Index >= len(p.Text) {
        return 0
    }
    result := p.Text[p.Index]
    p.Index++
    return result
}

func (p *Parser) peek(n int) byte {
    if p.Index+n >= len(p.Text) {
        return 0
    }
    return p.Text[p.Index+n]
}

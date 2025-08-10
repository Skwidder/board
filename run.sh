if [[ "$1" == "build" ]]
then
    go build -C frontend -o ../build/
    go build -C backend -o ../build/
elif [[ "$1" == "frontend" ]]
then
    go build -C frontend -o ../build/
    cd frontend && ../build/frontend
elif [[ "$1" == "backend" ]]
then
    go build -C backend -o ../build/
    ./build/backend
else
    go build -C frontend -o ../build/
    go build -C backend -o ../build/
    ./build/backend & cd frontend && ../build/frontend
fi

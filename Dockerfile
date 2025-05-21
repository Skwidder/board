FROM ubuntu:latest

RUN apt-get update && apt-get -y upgrade

RUN apt-get install -y golang ca-certificates

RUN update-ca-certificates

ADD frontend /root/frontend
ADD backend /root/backend

RUN sed -i -e 's/localhost/0.0.0.0/g' /root/backend/main.go
RUN sed -i -e 's/localhost/0.0.0.0/g' /root/frontend/main.go

EXPOSE 8080
EXPOSE 9000

RUN echo "cd /root/frontend && go run *.go & cd /root/backend && go run *.go" > /root/start.sh
CMD ["sh", "/root/start.sh"]

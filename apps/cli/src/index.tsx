import React, { useState, useEffect } from 'react';
import { render, Text, Box, useInput } from 'ink';
import * as net from 'net';

const CLIApp = () => {
  const [messages, setMessages] = useState<string[]>(['Welcome to Koala CLI']);
  const [input, setInput] = useState('');

  useEffect(() => {
    const socketPath = process.env.ROO_CODE_IPC_SOCKET_PATH || '\\\\.\\pipe\\koala-code-ipc';
    const client = net.createConnection(socketPath, () => {
      setMessages((prev) => [...prev, 'Connected to VS Code Host']);
    });

    client.on('data', (data) => {
      setMessages((prev) => [...prev, `[Host]: ${data.toString()}`]);
    });

    client.on('error', (err) => {
      setMessages((prev) => [...prev, `[Error]: ${err.message}`]);
    });

    return () => {
      client.end();
    };
  }, []);

  useInput((char, key) => {
    if (key.return) {
      // Send input to socket (stubbed for simplicity)
      setMessages((prev) => [...prev, `> ${input}`]);
      setInput('');
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else {
      setInput((prev) => prev + char);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        {messages.map((msg, i) => (
          <Text key={i}>{msg}</Text>
        ))}
      </Box>
      <Box>
        <Text color="green">koala&gt; </Text>
        <Text>{input}</Text>
      </Box>
    </Box>
  );
};

render(<CLIApp />);

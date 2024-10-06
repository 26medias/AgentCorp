// src/components/Common/MessageItem.jsx
import React from 'react';
import { Card } from 'antd';
import moment from 'moment';
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSelector } from 'react-redux';

const MessageItem = ({ message }) => {
    const { users } = useSelector((state) => state.user);
    const userColorMap = users.reduce((acc, user, index) => {
        acc[user] = `hsl(${(index * 360) / users.length}, 60%, 70%)`;
        return acc;
    }, {});

    const { from, message: content, timestamp } = message;
    const msg = JSON.parse(content);
    const color = userColorMap[from] || '#000';

    return (
        <Card
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: 12 }}
            headStyle={{ color }}
            title={from}
            extra={moment(timestamp).format('YYYY-MM-DD HH:mm:ss')}
        >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.msg}</ReactMarkdown>
        </Card>
    );
};

export default MessageItem;

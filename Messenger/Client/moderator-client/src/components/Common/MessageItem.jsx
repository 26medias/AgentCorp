// src/components/Common/MessageItem.jsx
import React from 'react';
import { Card } from 'antd';
import moment from 'moment';
import { useSelector } from 'react-redux';

const MessageItem = ({ message }) => {
    const { users } = useSelector((state) => state.user);
    const userColorMap = users.reduce((acc, user, index) => {
        acc[user] = `hsl(${(index * 360) / users.length}, 60%, 70%)`;
        return acc;
    }, {});

    const { from, message: content, timestamp } = message;
    const color = userColorMap[from] || '#000';

    return (
        <Card
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: 12 }}
            headStyle={{ color }}
            title={from}
            extra={moment(timestamp).format('YYYY-MM-DD HH:mm:ss')}
        >
            <p>{content}</p>
        </Card>
    );
};

export default MessageItem;

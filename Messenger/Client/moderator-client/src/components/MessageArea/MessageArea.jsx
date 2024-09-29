// src/components/MessageArea/MessageArea.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import MessageItem from '../Common/MessageItem';
import { List } from 'antd';
import './MessageArea.less';

const MessageArea = () => {
    const { messages } = useSelector((state) => state.message);

    return (
        <div className="message-area">
            <List
                dataSource={messages}
                renderItem={(message) => <MessageItem message={message} />}
            />
        </div>
    );
};

export default MessageArea;

// src/components/Common/ChannelList.jsx
import React from 'react';
import { List } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { selectChannel } from '../../store/slices/channelSlice';
import { fetchChannelLogs } from '../../utils/websocket';

const ChannelList = () => {
    const { channels } = useSelector((state) => state.channel);
    const dispatch = useDispatch();

    const handleSelectChannel = (channel) => {
        dispatch(selectChannel(channel));
        fetchChannelLogs(channel);
    };

    return (
        <div>
            <h3>Channels</h3>
            <List
                dataSource={channels}
                renderItem={(item) => (
                    <List.Item onClick={() => handleSelectChannel(item)}>
                        {item}
                    </List.Item>
                )}
                size="small"
            />
        </div>
    );
};

export default ChannelList;

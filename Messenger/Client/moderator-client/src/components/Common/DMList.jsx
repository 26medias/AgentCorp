// src/components/Common/DMList.jsx
import React from 'react';
import { List } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { selectDM } from '../../store/slices/channelSlice';
import { fetchDirectLogs } from '../../utils/websocket';

const DMList = () => {
    const { directContacts, currentUser } = useSelector((state) => state.user);
    const dispatch = useDispatch();

    const handleSelectDM = (dmUser) => {
        dispatch(selectDM(dmUser));
        fetchDirectLogs(currentUser, dmUser);
    };

    return (
        <div>
            <h3>Direct Messages</h3>
            <List
                dataSource={directContacts}
                renderItem={(item) => (
                    <List.Item onClick={() => handleSelectDM(item)}>
                        {item}
                    </List.Item>
                )}
                size="small"
            />
        </div>
    );
};

export default DMList;

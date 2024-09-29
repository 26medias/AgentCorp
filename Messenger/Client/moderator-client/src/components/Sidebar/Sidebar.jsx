// src/components/Sidebar/Sidebar.jsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Divider } from 'antd';
import ServerSelector from '../Common/ServerSelector';
import UserList from '../Common/UserList';
import ChannelList from '../Common/ChannelList';
import DMList from '../Common/DMList';
import { fetchUsers } from '../../utils/websocket';
import './Sidebar.less';

const Sidebar = () => {
    const dispatch = useDispatch();
    const { serverName } = useSelector((state) => state.server);
    const { currentUser } = useSelector((state) => state.user);

    useEffect(() => {
        fetchUsers();
    }, [serverName]);

    return (
        <div className="sidebar">
            <ServerSelector />
            <Divider />
            <div>
                <strong>Signed in as:</strong> {currentUser}
            </div>
            <Divider />
            <UserList />
            <Divider />
            <ChannelList />
            <Divider />
            <DMList />
        </div>
    );
};

export default Sidebar;

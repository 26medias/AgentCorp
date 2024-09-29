// src/components/Common/ServerSelector.jsx
import React, { useState, useEffect } from 'react';
import { Input, Button } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { setServerName } from '../../store/slices/serverSlice';

const ServerSelector = () => {
    const dispatch = useDispatch();
    const currentServerName = useSelector((state) => state.server.serverName);
    const [serverNameInput, setServerNameInput] = useState(currentServerName);

    useEffect(() => {
        setServerNameInput(currentServerName);
    }, [currentServerName]);

    const handleSetServer = () => {
        dispatch(setServerName(serverNameInput || 'test_server'));
    };

    return (
        <div>
            <Input
                placeholder="Enter server name"
                value={serverNameInput}
                onChange={(e) => setServerNameInput(e.target.value)}
                onPressEnter={handleSetServer}
            />
            <Button type="primary" onClick={handleSetServer} style={{ marginTop: 8 }}>
                Set Server
            </Button>
        </div>
    );
};

export default ServerSelector;

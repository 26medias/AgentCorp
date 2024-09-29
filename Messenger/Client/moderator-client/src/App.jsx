// src/App.jsx
import React, { useEffect } from 'react';
import { Layout } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from './components/Sidebar/Sidebar';
import MessageArea from './components/MessageArea/MessageArea';
import connectWebSocket from './utils/websocket';
import './App.less';

const { Sider, Content } = Layout;

const App = () => {
    const dispatch = useDispatch();
    const serverName = useSelector((state) => state.server.serverName);
    const currentUser = useSelector((state) => state.user.currentUser);

    useEffect(() => {
        connectWebSocket(serverName, currentUser, dispatch);
        // Removed fetchDirectContacts from here
    }, [serverName, currentUser, dispatch]);

    return (
        <Layout>
            <Sider width={300} className="app-sider">
                <Sidebar />
            </Sider>
            <Content className="app-content">
                <MessageArea />
            </Content>
        </Layout>
    );
};

export default App;

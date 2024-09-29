// src/components/Common/UserList.jsx
import React from 'react';
import { List, Button } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentUser } from '../../store/slices/userSlice';

const UserList = () => {
    const { users, currentUser } = useSelector((state) => state.user);
    const dispatch = useDispatch();

    const handleSignInAsUser = (user) => {
        dispatch(setCurrentUser(user));
    };

    return (
        <div>
            <h3>Users</h3>
            <List
                dataSource={users}
                renderItem={(item) => (
                    <List.Item>
                        {item}
                        <Button
                            type="link"
                            onClick={() => handleSignInAsUser(item)}
                            disabled={item === currentUser}
                            style={{ marginLeft: 'auto' }}
                        >
                            Sign in as
                        </Button>
                    </List.Item>
                )}
                size="small"
            />
        </div>
    );
};

export default UserList;

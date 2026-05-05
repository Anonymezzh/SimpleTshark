import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';
import defaultSettings from '../settings.json';

interface UserState {
  userInfo: {
    userId: string | null;
    venueId: string | null;
    username: string;
    photoList: Record<string, any>[];
    initPwd: boolean | null;
    funcPermKeys: string[];
    permissionKeys: string[];
    roleList: Record<string, any>[];
  };
  settings?: typeof defaultSettings;
  userLoading: boolean;
}

const initialState: UserState = {
  userInfo: {
    userId: null,
    venueId: null,
    username: '张三',
    photoList: [],
    initPwd: null,
    funcPermKeys: [],
    permissionKeys: [],
    roleList: []
  },
  settings: defaultSettings,
  userLoading: false
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setSettings(state, action) {
      state.settings = action.payload;
    }
  }
});

export const { setSettings } = userSlice.actions;

export default userSlice.reducer;

import React from 'react';
import { Button, Message } from '@arco-design/web-react';
import { apiPost } from '@/services/api';
import { electronAPI } from '@/utils/tauri';

function SaveData({ filter = null }) {
    // 保存过滤条件
    const saveData = async () => {
        try {
            const selectedFilePath = await electronAPI.showSavePath()
            if (selectedFilePath) {
                try {
                    await apiPost('/api/savePacket', { filePath: selectedFilePath, filter })
                    Message.success('保存成功')
                } catch {
                }
            }
        } catch (error) {
            // console.error('文件选择或读取失败:', error);
        }
    }
    return <Button type="primary" style={{ position: 'absolute', top: 14, zIndex: 999, left: 480 }} onClick={saveData}>保存筛选结果</Button>;
}

export default SaveData;

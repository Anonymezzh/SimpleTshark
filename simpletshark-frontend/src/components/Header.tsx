import React, { useState, useContext, useEffect, useRef } from 'react';
import { Button, Tooltip, Modal } from '@arco-design/web-react';
import Logo from '@/assets/images/logo.png';
import { GlobalContext } from '@/context';
import { IconSunFill, IconMoonFill, IconSkin } from '@arco-design/web-react/icon';
import { MinimizeIcon, MaximizeIcon, UnmaximizeIcon, CloseIcon } from '@/utils/icons'
import styles from '../style/layout.module.less';
import IconButton from './NavBar/IconButton';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logger from '@/utils/logger';
import background1 from '@/assets/images/background1.jpg';
import background2 from '@/assets/images/background2.jpg';
import background3 from '@/assets/images/background3.jpg';
import background4 from '@/assets/images/background4.jpg';
import background5 from '@/assets/images/background5.jpg';
import background6 from '@/assets/images/background6.jpg';
import background7 from '@/assets/images/background7.jpg';

const backgrounds = [
    { name: '背景1', image: background1 },
    { name: '背景2', image: background2 },
    { name: '背景3', image: background3 },
    { name: '背景4', image: background4 },
    { name: '背景5', image: background5 },
    { name: '背景6', image: background6 },
    { name: '背景7', image: background7 },
];

const gradientBackgrounds = [
    { name: '浅蓝渐变', gradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' },
    { name: '浅绿渐变', gradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' },
];

const Header = ({ type, transparent = false }) => {
    const headerRef = useRef(null);
    const [max, setMax] = useState(false)
    const { theme, setTheme, background, setBackground } = useContext(GlobalContext);
    const [showSkinModal, setShowSkinModal] = useState(false);
    const [tempBackground, setTempBackground] = useState(background);
    const minimize = async () => {
        logger.info('Header: minimize clicked');
        try { await getCurrentWindow().minimize(); logger.info('Header: minimize executed'); } catch (e) { logger.error('Header: minimize failed', e); }
    }
    const maximize = async () => {
        logger.info('Header: maximize clicked');
        try {
            await getCurrentWindow().maximize();
            setMax(true)
            logger.info('Header: maximize executed');
        } catch (e) { logger.error('Header: maximize failed', e); }
    }
    const unmaximize = async () => {
        logger.info('Header: unmaximize clicked');
        try {
            await getCurrentWindow().unmaximize();
            setMax(false)
            logger.info('Header: unmaximize executed');
        } catch (e) { logger.error('Header: unmaximize failed', e); }
    }
    const close = async () => {
        logger.info('Header: close clicked');
        try {
            if (type === 'mainWindow') {
                // 保存需要保留的设置
                const backgroundToKeep = localStorage.getItem('simpletshark-background');
                const themeToKeep = localStorage.getItem('arco-theme');
                const langToKeep = localStorage.getItem('arco-lang');

                // 清空其他数据
                localStorage.clear();

                // 恢复保留的设置
                if (backgroundToKeep !== null) {
                    localStorage.setItem('simpletshark-background', backgroundToKeep);
                }
                if (themeToKeep !== null) {
                    localStorage.setItem('arco-theme', themeToKeep);
                }
                if (langToKeep !== null) {
                    localStorage.setItem('arco-lang', langToKeep);
                }
            }
            await getCurrentWindow().close();
            logger.info('Header: close executed');
        } catch (e) { logger.error('Header: close failed', e); }
    }

    // 处理窗口拖拽
    const handleDragStart = async (e: React.MouseEvent) => {
        // 如果点击的是按钮或其他交互元素,不触发拖拽
        const target = e.target as HTMLElement;
        const isOnControl = !!(target.closest('button') || target.closest('span[class*="Icon"]') || target.closest('.arco-btn'))
        logger.debug('Header: mousedown', { isOnControl, tag: target.tagName, className: target.className });
        if (isOnControl) {
            return;
        }

        e.preventDefault();
        try {
            await getCurrentWindow().startDragging();
            logger.info('Header: startDragging executed');
        } catch (error) {
            logger.error('Header: startDragging failed', error);
        }
    };

    // 处理双击最大化/恢复
    const handleDoubleClick = async (e: React.MouseEvent) => {
        // 如果点击的是按钮或其他交互元素,不触发最大化
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('span[class*="Icon"]') || target.closest('.arco-btn')) {
            return;
        }

        try {
            const window = getCurrentWindow();
            const isMaximized = await window.isMaximized();
            logger.debug('Header: doubleClick, isMaximized', isMaximized);

            if (isMaximized) {
                await window.unmaximize();
                setMax(false);
                logger.info('Header: doubleClick -> unmaximize executed');
            } else {
                await window.maximize();
                setMax(true);
                logger.info('Header: doubleClick -> maximize executed');
            }
        } catch (error) {
            logger.error('Header: toggle maximize failed', error);
        }
    };

    const [originalBackground, setOriginalBackground] = useState(background);

    const handleOpenSkinModal = () => {
        setOriginalBackground(background);
        setTempBackground(background);
        setShowSkinModal(true);
    };

    const handleConfirmSkin = () => {
        setBackground(tempBackground);
        localStorage.setItem('simpletshark-background', tempBackground || '');
        setShowSkinModal(false);
    };

    const handleCancelSkin = () => {
        setBackground(originalBackground);
        setTempBackground(originalBackground);
        setShowSkinModal(false);
    };

    const handleSelectBackground = (bg: string) => {
        setTempBackground(bg);
        setBackground(bg); // 立即预览
    };

    useEffect(() => {
        setTempBackground(background);
    }, [background]);

    return <>
        <div
            ref={headerRef}
            className={`${styles.title} ${transparent ? styles.titleTransparent : ''}`}
            data-tauri-drag-region="true"
        >
            <div
                className={`${styles.titleLeft}`}
                style={{ color: transparent ? '#000' : 'var(--color-text-1)' }}
                onMouseDown={handleDragStart}
                onDoubleClick={handleDoubleClick}
                data-tauri-drag-region="true"
            >
                <img src={Logo} style={{ width: 16 }} className='mr-2' data-tauri-drag-region="false" />
                <span>SimpleTshark</span>
            </div>
            <div
                className={`${styles.titleRight} flex items-center`}
                data-no-drag="true"
                data-tauri-drag-region="false"
            >
                <div>
                    <Tooltip content="换肤">
                        <IconButton
                            icon={<IconSkin />}
                            onClick={handleOpenSkinModal}
                        />
                    </Tooltip>
                </div>
                <span onClick={minimize} className='ml-7' style={{ color: transparent ? '#000' : 'var(--color-text-2)' }}><MinimizeIcon /></span>
                {max ? <span onClick={unmaximize} className='ml-8' style={{ color: transparent ? '#000' : 'var(--color-text-2)' }}><UnmaximizeIcon /></span> :
                    <span onClick={maximize} className='ml-8' style={{ color: transparent ? '#111' : 'var(--color-text-3)' }}><MaximizeIcon /></span>}
                <span onClick={close} className='ml-7' style={{ color: transparent ? '#000' : 'var(--color-text-2)', marginTop: 3 }}><CloseIcon /></span>
            </div>
        </div>

        <Modal
            title='选择背景'
            visible={showSkinModal}
            onOk={handleConfirmSkin}
            onCancel={handleCancelSkin}
            autoFocus={false}
            style={{ width: 750 }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px 0' }}>
                {/* 纯白色选项 */}
                <div
                    onClick={() => handleSelectBackground('')}
                    style={{
                        height: 130,
                        backgroundColor: '#fff',
                        border: tempBackground === '' ? '3px solid rgb(var(--primary-6))' : '2px solid var(--color-border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#666',
                        transition: 'all 0.3s'
                    }}
                >
                    纯白色
                </div>

                {/* 渐变色选项 */}
                {gradientBackgrounds.map((bg, index) => (
                    <div
                        key={`gradient-${index}`}
                        onClick={() => handleSelectBackground(bg.gradient)}
                        style={{
                            height: 130,
                            background: bg.gradient,
                            border: tempBackground === bg.gradient ? '3px solid rgb(var(--primary-6))' : '2px solid var(--color-border)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 500,
                            color: '#666',
                            transition: 'all 0.3s',
                            position: 'relative'
                        }}
                    >
                        {tempBackground === bg.gradient && (
                            <div style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                backgroundColor: 'rgb(var(--primary-6))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: 14
                            }}>✓</div>
                        )}
                        {bg.name}
                    </div>
                ))}

                {/* 背景图选项 */}
                {backgrounds.map((bg, index) => (
                    <div
                        key={index}
                        onClick={() => handleSelectBackground(bg.image)}
                        style={{
                            height: 130,
                            backgroundImage: `url(${bg.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: tempBackground === bg.image ? '3px solid rgb(var(--primary-6))' : '2px solid var(--color-border)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.3s'
                        }}
                    >
                        {tempBackground === bg.image && (
                            <div style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                backgroundColor: 'rgb(var(--primary-6))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: 14
                            }}>✓</div>
                        )}
                    </div>
                ))}
            </div>
        </Modal>
    </>
}

export default Header;

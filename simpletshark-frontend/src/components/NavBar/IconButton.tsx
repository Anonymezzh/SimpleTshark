import React, { forwardRef } from 'react';
import { Button } from '@arco-design/web-react';
import styles from './style/icon-button.module.less';
import cs from 'classnames';

function IconButton(props, ref) {
  const { icon, className, ...rest } = props;

  return (
    <Button
      ref={ref}
      icon={icon}
      shape="circle"
      type="secondary"
      size="small"
      style={{width: 22, height: 22, lineHeight: '12px', background: 'transparent'}}
      className={cs(styles['icon-button'], className)}
      {...rest}
    />
  );
}

export default forwardRef(IconButton);

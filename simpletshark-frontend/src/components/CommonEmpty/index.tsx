import React from 'react';
import { Empty } from '@arco-design/web-react';
import styles from './styles/empty.module.less';

const CommonEmpty = () => {
  return <div className={`${styles['common-empty']}`}>
    <Empty />
  </div>;
};

export default React.memo(CommonEmpty);
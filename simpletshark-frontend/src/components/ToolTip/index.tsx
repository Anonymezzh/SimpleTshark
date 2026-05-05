import React, { ReactElement } from 'react';
import { Tooltip, Typography } from '@arco-design/web-react';
import { IconInfoCircle } from '@arco-design/web-react/icon';

const ToolTip = ({ msg, children }: {
  msg: string;
  children?: ReactElement
}) => {
  return <Tooltip content={msg}>
    {children ? children : <IconInfoCircle className="text-lg !text-gray-500 ml-1" />}
  </Tooltip>;
};

export default React.memo(ToolTip);
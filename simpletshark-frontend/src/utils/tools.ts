import { isEmpty, isString, concat, repeat } from 'lodash';
import { getNationalFlagSrc, formatFileSize } from './tool'

export function setEncrypt(value: string, start = 0, end = 0) {
  if (isEmpty(value)) {
    return '';
  }
  if (!isString(value)) {
    return value;
  }
  const result = concat(
    value.slice(0, start),
    repeat('*', (value.length - start - end > 4 ? 4 : 1)),
    value.slice(-end)
  ).join('');
  return result;
}

/**
 * 获取脱敏字符串
 * @param type name:姓名，idCard:身份证
 * @param value
 * @param type
 */
export const getDesString = (value: string, type: string) => {
  if (isEmpty(value)) {
    return '';
  }
  if (!isString(value)) {
    return value;
  }
  let result = value;
  switch (type) {
    case 'name':
      result = value.substring(0, 1) + repeat('*', (value.length - 1) > 4 ? 4 : value.length - 1);
      break;
    case 'idCard':
      result = value.substring(value.length - 4, value.length);
      break;
  }
  return result;
};

/**
 * 获取非空数组
 * @param value
 */
export const getAvailableArray = (value: any) => {
  return (value ?? '') === '' ? [] : value;
};

/**
 * 获取url参数
 * @param url
 */
export const getUrlParams = (url) => {
  const paramsArray = url.split('?')[1].split('&');
  const params = paramsArray.reduce((acc, param) => {
    const [key, value] = param.split('=');
    acc[key] = value;
    return acc;
  }, {});
  return params;
};

// ip+ip地址+国旗
export const ipWithAddrAndFlag = (ip, addr) => {
  const imgSrc = getNationalFlagSrc(addr)
	return imgSrc
}
/**
 * 流量单位
 * @param val 原始值
 * @param unit 单位
 * @returns {string} 返回值
 */
export const filterSpeed = (value, unit = 'B') => {
	return value || value == 0 ? formatFileSize(value, unit ? unit : 'B') : '0'
}
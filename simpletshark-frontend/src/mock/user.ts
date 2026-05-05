import Mock from 'mockjs';
import { isSSR } from '@/utils/is';

if (!isSSR) {
  Mock.XHR.prototype.withCredentials = true;
}

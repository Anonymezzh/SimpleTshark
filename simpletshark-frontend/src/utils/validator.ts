// 校验中国大陆手机号
export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

// 校验中国身份证号码（简单校验）
export const validateIDCardNumber = (idCard: string): boolean => {
  const idCardRegex = /^[1-9]\d{5}(18|19|20)?\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/;
  return idCardRegex.test(idCard);
};

// 大于0的正整数正则校验
export const validatePositiveInteger = (value: number): boolean => {
  if (typeof Number(value) !== 'number') return false;
  const regExp = /^[1-9]\d*$/;
  return regExp.test(value.toString());
};

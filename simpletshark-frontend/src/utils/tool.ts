import dayjs from 'dayjs'
// 按指定字段分组
export const groupBySpaceType = (array, key) => {
  return array.reduce((groups, item) => {
    const group = groups[item[key]] || [];
    group.push(item);
    groups[item[key]] = group;
    return groups;
  }, {});
};

/**
* 根据输入的国家中文名 输出该国家国旗路径
* @param {string} nation - 输入的国家中文名
* @param {string} [basePath='/'] - 图片基础路径
* @return {string}
* @example
* getNationalFlagSrc('中国')
*/
export const getNationalFlagSrc = (nation, basePath = '/nationalFlag/', type = '') => {
  nation = nation || ''
  const nationWithFlagPath = {
    本地局域网: 'bdjyw.png',
    内网IP: 'bdjyw.png',
    中国: 'zg.png',
    香港: 'zg.png',
    台湾: 'zg.png',
    澳门: 'zg.png',
    日本: 'rb.png',
    韩国: 'hg.png',
    美国: 'mg.png',
    俄罗斯: 'els.png',
    朝鲜: 'cx.png',
    老挝: 'lw.png',
    印度: 'yd.png',
    印尼: 'yn.png',
    约旦: 'yued.png',
    缅甸: 'md.png',
    蒙古: 'mgu.png',
    不丹: 'bd.png',
    泰国: 'tg.png',
    越南: 'yuen.png',
    阿曼: 'am.png',
    也门: 'ym.png',
    沙特: 'st.png',
    阿富汗: 'afh.png',
    阿联酋: 'alq.png',
    巴林: 'bl.png',
    科威特: 'kwt.png',
    土耳其: 'teq.png',
    文莱: 'wl.png',
    黎巴嫩: 'lbn.png',
    孟加拉: 'mjl.png',
    新加坡: 'xjp.png',
    格鲁吉亚: 'gljy.png',
    马尔代夫: 'medf.png',
    伊朗: 'yl.png',
    以色列: 'ysl.png',
    叙利亚: 'xly.png',
    卡塔尔: 'kte.png',
    柬埔寨: 'jpz.png',
    塞浦路斯: 'spls.png',
    土库曼: 'tkm.png',
    尼泊尔: 'nbe.png',
    乌兹别克: 'wzbk.png',
    伊拉克: 'ylk.png',
    哈萨克: 'hsk.png',
    斯里兰卡: 'sllk.png',
    马来西亚: 'mlxy.png',
    菲律宾: 'flb.png',
    巴勒斯坦: 'blst.png',
    加蓬: 'jp.png',
    亚美尼亚: 'ymny.png',
    埃及: 'aj.png',
    多哥: 'dg.png',
    刚果: 'gg.png',
    加纳: 'jn.png',
    马里: 'ml.png',
    中非: 'zf.png',
    苏丹: 'sd.png',
    卢旺达: 'lwd.png',
    安哥拉: 'agl.png',
    佛得角: 'fdj.png',
    冈比亚: 'gby.png',
    吉布提: 'jbt.png',
    利比亚: 'lby.png',
    喀麦隆: 'kml.png',
    科摩罗: 'keml.png',
    莱索托: 'lst.png',
    尼日尔: 'nre.png',
    突尼斯: 'tns.png',
    赞比亚: 'zby.png',
    马拉维: 'mlw.png',
    乌干达: 'wgd.png',
    摩洛哥: 'mlg.png',
    博茨瓦纳: 'bzwl.png',
    利比里亚: 'lbly.png',
    科特迪瓦: 'ktdw.png',
    毛里求斯: 'mlqs.png',
    民主刚果: 'mzgg.png',
    尼日利亚: 'nrly.png',
    塞拉利昂: 'slla.png',
    南非: 'nf.png',
    布隆迪: 'bld.png',
    莫桑比克: 'msbk.png',
    津巴布韦: 'jbbw.png',
    几内亚: 'jny.png',
    厄立特里亚: 'eltly.png',
    坦桑尼亚: 'tsny.png',
    肯尼亚: 'kny.png',
    斯威士兰: 'swsl.png',
    西撒哈拉: 'xshl.png',
    塞舌尔: 'sse.png',
    布基纳法索: 'bjnlfs.png',
    赤道几内亚: 'cdjny.png',
    索马里: 'sml.png',
    几内亚比绍: 'jnybs.png',
    圣多美和普林西比: 'plxb.png',
    阿尔及利亚: 'aejly.png',
    毛里塔尼亚: 'mltny.png',
    冰岛: 'bdao.png',
    纳米比亚: 'nmby.jpg',
    埃塞俄比亚: 'aseby.png',
    马达加斯加: 'mdjsj.png',
    波黑: 'bh.png',
    德国: 'germany.png',
    波兰: 'poland.png',
    法国: 'france.png',
    捷克: 'Chech.png',
    荷兰: 'Netherlands.png',
    瑞士: 'Switzerland.png',
    英国: 'England.png',
    希腊: 'Greece.png',
    瑞典: 'Sweden.png',
    爱尔兰: 'Ireland.png',
    安道尔: 'Andorra.png',
    奥地利: 'Austria.png',
    比利时: 'Belgium.png',
    梵蒂冈: 'Vatican.png',
    马耳他: 'Malta.png',
    西班牙: 'Spain.png',
    乌克兰: 'Ukraine.png',
    葡萄牙: 'Portugal.png',
    意大利: 'Italy.png',
    匈牙利: 'Hungary.png',
    白俄罗斯: 'Belarus.png',
    南斯拉夫: 'Yugoslavia.png',
    克罗地亚: 'Croatia.png',
    拉脱维亚: 'Latvia.png',
    保加利亚: 'Bulgaria.png',
    罗马尼亚: 'Romania.png',
    摩尔多瓦: 'Moldova.png',
    斯洛文尼亚: 'Slovenia.png',
    阿尔巴尼亚: 'Albania.png',
    列支敦士登: 'Liechtenstein.png',
    芬兰: 'Finland.png',
    卢森堡: 'Luxembourg.png',
    立陶宛: 'Lithuania.png',
    挪威: 'Norway.png',
    摩纳哥: 'Monaco.png',
    所罗门群岛: 'Solomon.png',
    爱沙尼亚: 'Estonia.png',
    斯洛伐克: 'Slovakia.png',
    智利: 'Chile.png',
    古巴: 'Cuba.png',
    海地: 'Haiti.png',
    圭亚那: 'Guyana.png',
    委内瑞拉: 'Venezuela.png',
    安提瓜和巴布达: 'AntiguaAndBarbuda.png',
    伯利兹: 'Belize.png',
    巴哈马: 'Bahamas.png',
    巴拿马: 'Panama.png',
    墨西哥: 'Mexico.png',
    苏里南: 'Suriname.png',
    加拿大: 'Canada.png',
    厄瓜多尔: 'Ecuador.png',
    格林纳达: 'Grenada.png',
    洪都拉斯: 'Honduras.png',
    巴西: 'Brazil.png',
    玻利维亚: 'Bolivia.png',
    秘鲁: 'Peru.png',
    阿根廷: 'Argentina.png',
    圣卢西亚: 'SaintLucia.png',
    多米尼克: 'Dominican.png',
    巴拉圭: 'Paraguay.png',
    尼加拉瓜: 'Nicaragua.png',
    哥伦比亚: 'Columbia.png',
    乌拉圭: 'Uruguay.png',
    巴巴多斯: 'Barbados.png',
    瑙鲁: 'Nauru.png',
    牙买加: 'Jamaica.png',
    危地马拉: 'Guatemala.png',
    斐济: 'Fiji.png',
    哥斯达黎加: 'CostaRita.png',
    圣基茨和尼维斯: 'SaintKittsAndNevis.png',
    新西兰: 'NewZealand.png',
    特立尼达和多巴哥: 'TrinidadAndTobago.png',
    圣文森特和格林纳丁斯: 'SaintVincentAndGrenadines.png',
    基里巴斯: 'Kiribati.png',
    纽埃: 'Niue.png',
    巴新: 'PapuaNewGuinea.png',
    萨摩亚: 'Samoa.png',
    汤加: 'Tonga.png',
    帛琉: 'Palau.png',
    澳大利亚: 'Australian.png',
    瓦努阿图: 'Vanuatu.png',
    图瓦卢: 'Tuvalu.png',
    密克罗尼西亚: 'Micronesia.png',
    库克群岛: 'Cook.png',
    马绍尔群岛: 'Marshall.png',
    科索沃: 'Kosovo.png',
    东帝汶: 'TimorLeste.png',
    黑山: 'Montenegro.png'
  }
  let src = !type && localStorage.getItem('theme') === 'speed' ? 'default1.png' : 'default.png'
  for (const key in nationWithFlagPath) {
    if (nation.includes(key)) {
      src = nationWithFlagPath[key]
      break
    }
  }
  return basePath + src
}

/**
 * formatFileSize. 文件大小格式化
 *
 * @param      {<type>}    [fileSize]      文件大小,单位字节
 * @param      {string}    [unit]          文件单位
 */
export const formatFileSize = (fileSize, unit = 'B') => {
  if (fileSize == null || fileSize === '' || !fileSize || fileSize === '0') {
    if (unit === 'bit') return '0bps'
    else return '0' + unit
  }
  const unitArr = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
  let index = 0
  let size = 0
  if (unit === 'bit') fileSize = fileSize * 8
  if (fileSize > 1) {
    const srcSize = parseFloat(fileSize)
    index = Math.floor(Math.log(srcSize) / Math.log(1024))
    size = srcSize / Math.pow(1024, index)
    size = Math.round(size * 100) / 100
  } else {
    size = fileSize
  }
  let str = ''
  if (unit === 'bit') {
    str = `${size} ${unitArr[index] ? unitArr[index] : ''}bps`
  } else {
    str = size + unitArr[index] + unit
  }
  return str
}
/**
 * formatAvgSpeed. 文件大小格式化byte转b/s
 */
export const formatAvgSpeed = (fileSize) => {
  const unitArr = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
  let index = 0
  let size = 0
  fileSize = fileSize / 8
  if (fileSize > 1) {
    const srcSize = parseFloat(fileSize)
    index = Math.floor(Math.log(srcSize) / Math.log(1024))
    size = srcSize / Math.pow(1024, index)
    size = Math.round(size * 100) / 100
  } else {
    size = fileSize
  }
  let str = ''
  str = size + unitArr[index] + 'B/s'
  return str
}
/**
 * @feature 用千分位表示数字 以','隔开
 * @param {number} 传入数字
 * @return {string} 返回千分位表示的数字
 */
export const numberWithCommas = (x, unit = '') => {
  if (x === undefined || x === null) {
    return '0'
  }
  if (typeof x !== 'number') x = parseInt(x)
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + unit
}

/**
 * 打开新页签
 * @param url      [String]      新页签地址
 * @param flag     {Boolean}     是否直接用地址打开
 */
export const openTabByUrl = (url, flag) => {
  const el = document.createElement('a')
  document.body.appendChild(el)
  el.href = flag
    ? url
    : encodeURI(`${location.protocol}//${location.host}${location.pathname}#${url}`)
  el.target = '_blank'

  el.click()
  document.body.removeChild(el)
}

/**
 * @feature 判断输入的字符串是否为十六进制
 * @param {string}
 * @return {boolean}
 */
export const isHexadecimal = (str) => {
  const reg = /^[A-F0-9]+$/i
  return reg.test(str)
}
/**
 * @feature 判断输入的字符串是否为十进制
 * @param {string}
 * @return {boolean}
 */
export const isNumericadecimal = (str) => {
  const reg = /^-{0,1}\d*\.{0,1}\d+$/
  return reg.test(str)
}

/**
 * @feature 判断输入的字符串是否为十六进制 要求为0-9，A-F，a-F，长度为4-50
 * @param {string}
 * @return {boolean}
 */
export const isHexadecimalAndLength = (str) => {
  const reg = new RegExp(/^[a-fA-F0-9]{4,50}$/)
  return reg.test(str)
}
/**
 * @feature 判断输入的字符串是否为ASCII 长度为2-25  将字符转为10进制 判断是否在合法范围内
 * @param {string}
 * @return {boolean}
 */
export const isASCIIAndLength = (str) => {
  if (str.length >= 2 && str.length <= 25) {
    const acsii = str.split('')
    for (let i = 0; i < acsii.length; i++) {
      const tenNum = str.charCodeAt()
      if (tenNum >= 32 && tenNum <= 126) {
        return true
      } else {
        return false
      }
    }
  } else {
    return false
  }
}

/**
 * @feature 判断输入的字符串是否为ASCII
 * @param {string}
 * @return {boolean}
 */
export const isASCII = (str) => {
  const reg = /^[\x00-\x7F]+$/i
  return reg.test(str)
}
/**
 * @feature 十六进制转十进制整数
 * @param {string}
 * @return {string}
 */
export const hex2int = (hex) => {
  const len = hex.length
  const a = new Array(len)
  let code
  for (let i = 0; i < len; i++) {
    code = hex.charCodeAt(i)
    if (48 <= code && code < 58) {
      code -= 48
    } else {
      code = (code & 0xdf) - 65 + 10
    }
    a[i] = code
  }

  return a.reduce(function (acc, c) {
    acc = 16 * acc + c
    return acc
  }, 0)
}
/**
 * @feature 十六进制转ASCII
 * @param {string}
 * @return {string}
 */
export const hexCharCodeToStr = (hex) => {
  const _hex = hex.toString()
  let str = ''
  for (let i = 0; i < _hex.length; i += 2) {
    const ten = hex2int(_hex.substr(i, 2))
    if (ten == hex2int('0d')) { //13
      str += '换'
    } else if (ten == hex2int('0a')) { //10
      str += '行'
    } else if (ten <= 32 || ten >= 127) {
      str += '无'
    } else {
      str += String.fromCharCode(parseInt(_hex.substr(i, 2), 16))
    }
  }
  return str
}
/**
 * @feature 十六进制转ASCII, 换行，不存在字符全部用. 代替
 * @param {string}
 * @return {string}
 */
export const hexCharCodeToAscStr = (hex) => {
  const _hex = hex.toString()
  let str = ''
  for (let i = 0; i < _hex.length; i += 2) {
    const ten = hex2int(_hex.substr(i, 2))
    // if(ten == hex2int('0d') || ten == hex2int('0a') || ten <= 32 || ten >= 127) {
    if (ten <= 32 || ten >= 127) {
      str += ten === 13 ? '\n' : ten === 10 ? '\r' : ten === '2E' ? '.' : '.'
    } else {
      str += String.fromCharCode(parseInt(_hex.substr(i, 2), 16))
    }
  }
  return str
}
/**
 * @feature 字符串按指定位数，符号分割
 * @param {string} str-字符串
 * @param {string} str-字符串
 * @param {string} sign-用什么符号分割
 */
export const strSexteenSplit = (str, number, sign) => {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    result += str[i] === '\r' || str[i] === '\n' ? ' .' : ` ${str[i]}`
    if ((i + 1) % number == 0 && str[i + 1]) {
      result += sign
    }
  }
  return result
}
/**
 * @feature 字符串每两位分割
 */
export const strTwoSplit = (str) => {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    result += str[i]
    if (i % 2 === 1) {
      result += ','
    }
  }
  return result
}
/**
 * @feature 判断是否为整数
 * @return {Boolean}
 */
export const isInteger = (num) => {
  if (!isNaN(num) && num % 1 === 0) {
    return true
  } else {
    return false
  }
}
/**
 * @feature 数字位数不足指定位数时，左侧补0
 * @param {string} n-初始数字
 * @param {string} targetLen-数字位数为几位
 * @param {placeholder} placeholder-补什么数字
 * 例： padNumber(10, 8, 0) 结果：00000010
 * @return {string}
 */
export const padNumber = (n, targetLen, placeholder) => {
  const arr = ('' + n).split('')
  const diff = arr.length - targetLen
  if (diff < 0) {
    return Array(0 - diff)
      .fill(placeholder, 0, 0 - diff + 1)
      .concat(arr)
      .join('')
  } else {
    return arr.join('')
  }
}

/**
 * @feature 树结构转一维数组
 * @param {array}
 * @return {array}
*/
export const treeList = (arr) => {
  const data = JSON.parse(JSON.stringify(arr))
  const newData = []
  const callback = (item) => {
    (item.children || (item.children = [])).map((v) => {
      callback(v)
    })
    delete item.children
    newData.push(item)
  }
  data.map((v) => callback(v))
  return newData
}
// 计算持续时间
export const calculateDuration = (startTime, endTime) => {
  // 确保 startTime 和 endTime 是有效的 dayjs 对象
  if (!dayjs(startTime).isValid() || !dayjs(endTime).isValid()) {
    return
  }
  // 计算时间差（以秒为单位）
  const durationMs = (endTime * 1000) - (startTime * 1000)

  // 将秒转换为分钟和秒
  const totalSeconds = Math.floor(durationMs / 1000); // 总秒数
  const milliseconds = Math.round(durationMs % 1000); // 剩余毫秒数
  const days = Math.floor(totalSeconds / (24 * 60 * 60)); // 天
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60)); // 小时
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60); // 分钟
  const seconds = totalSeconds % 60; // 秒
  if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  } else if (seconds > 0) {
    return `${seconds}秒`
  } else {
    return milliseconds ? `${milliseconds}毫秒` : 0
  }
}

// LineChart.js
import React from 'react'
import EChartsReact from 'echarts-for-react'

function LineChart({ data }) {
  const xData: any[] = []
  const arr: any[] = []
  data.forEach((item: any) => {
    xData.push(item.time)
    arr.push(item.bytes)
  })
  const option = {
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      data: xData,
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
    },
    series: [
      {
        type: 'line',
        data: arr,
        symbol: 'none',
        smooth: true,
        lineStyle: { width: 1, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
      },
    ],
  }
  return <EChartsReact option={option} style={{ height: 35 }} />
}

export default LineChart

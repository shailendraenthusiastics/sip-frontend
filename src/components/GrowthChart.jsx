import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export default function GrowthChart({ chartData }) {
  if (!chartData || chartData.length === 0) {
    return null
  }

  const labels = chartData.map((item) => `Year ${item.year}`)
  const invested = chartData.map((item) => item.invested)
  const futureValue = chartData.map((item) => item.future_value)

  const data = {
    labels,
    datasets: [
      {
        label: 'Invested Amount',
        data: invested,
        borderColor: '#6fe7c8',
        backgroundColor: 'rgba(111, 231, 200, 0.15)',
        tension: 0.35,
        fill: true,
      },
      {
        label: 'Future Value',
        data: futureValue,
        borderColor: '#ffd36e',
        backgroundColor: 'rgba(255, 211, 110, 0.12)',
        tension: 0.35,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#d9e7f3',
          font: {
            family: 'Manrope',
          },
        },
      },
      tooltip: {
        backgroundColor: '#07131f',
        titleColor: '#ffffff',
        bodyColor: '#d9e7f3',
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#a6b9cc',
        },
        grid: {
          color: 'rgba(255,255,255,0.06)',
        },
      },
      y: {
        ticks: {
          color: '#a6b9cc',
        },
        grid: {
          color: 'rgba(255,255,255,0.06)',
        },
      },
    },
  }

  return (
    <div className="chart-shell">
      <Line data={data} options={options} />
    </div>
  )
}

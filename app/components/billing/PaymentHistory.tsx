'use client';

interface Payment {
  id: string;
  amount: number;
  method: 'paypal' | 'mobile_money';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  metadata?: Record<string, any>;
}

export default function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600">No payments yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Method</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b hover:bg-gray-50">
              <td className="px-6 py-4 text-sm">
                {new Date(payment.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 text-sm font-semibold">${payment.amount.toFixed(2)}</td>
              <td className="px-6 py-4 text-sm">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {payment.method === 'paypal' ? 'PayPal' : 'Mobile Money'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    payment.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : payment.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

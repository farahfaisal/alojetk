import React from 'react';
import * as Icons from 'lucide-react';
import { getStatusInfoSync, getColorClasses } from '@/lib/shipping-statuses';

/**
 * مثال على Badge لعرض حالة الطلب
 *
 * الاستخدام:
 * <StatusBadge status="shipping" />
 */
export function StatusBadge({ status }: { status: string }) {
  const statusInfo = getStatusInfoSync(status);
  const colors = getColorClasses(statusInfo.color);
  const Icon = Icons[statusInfo.icon_name as keyof typeof Icons] as React.ComponentType<{ size?: number; className?: string }> || Icons.Package;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${colors.bg} ${colors.border} border`}>
      <Icon size={18} className={colors.text} />
      <span className={`font-semibold ${colors.text}`}>
        {statusInfo.ar_title}
      </span>
    </div>
  );
}

/**
 * مثال على Card كامل لعرض حالة الطلب مع الوصف
 *
 * الاستخدام:
 * <StatusCard status="shipping" driverName="محمد أحمد" />
 */
export function StatusCard({
  status,
  driverName
}: {
  status: string;
  driverName?: string;
}) {
  const statusInfo = getStatusInfoSync(status);
  const colors = getColorClasses(statusInfo.color);
  const Icon = Icons[statusInfo.icon_name as keyof typeof Icons] as React.ComponentType<{ size?: number; className?: string }> || Icons.Package;

  return (
    <div className={`${colors.bg} ${colors.border} border-2 rounded-xl p-5`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${colors.text} bg-white`}>
          <Icon size={28} />
        </div>
        <div className="flex-1">
          <h3 className={`text-xl font-bold ${colors.text} mb-1`}>
            {statusInfo.ar_title}
          </h3>
          <p className={`${colors.text} opacity-80 text-sm mb-2`}>
            {statusInfo.ar_description}
          </p>
          {driverName && status === 'shipping' && (
            <div className="flex items-center gap-2 mt-3">
              <Icons.User size={16} className={colors.text} />
              <span className={`text-sm font-semibold ${colors.text}`}>
                السائق: {driverName}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * مثال على Timeline لتتبع حالة الطلب
 *
 * الاستخدام:
 * <StatusTimeline currentStatus="shipping" />
 */
export function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const statusInfo = getStatusInfoSync(currentStatus);

  const normalStatuses = [
    'pending',
    'accepted',
    'processing',
    'ready',
    'shipping',
    'delivering',
    'completed'
  ];

  const currentIndex = normalStatuses.indexOf(currentStatus);

  return (
    <div className="space-y-3">
      {normalStatuses.map((statusKey, index) => {
        const info = getStatusInfoSync(statusKey);
        const colors = getColorClasses(info.color);
        const Icon = Icons[info.icon_name as keyof typeof Icons] as React.ComponentType<{ size?: number; className?: string }> || Icons.Package;

        const isActive = statusKey === currentStatus;
        const isPassed = index < currentIndex;
        const isFuture = index > currentIndex;

        return (
          <div
            key={statusKey}
            className={`
              flex items-center gap-4 p-4 rounded-lg transition-all
              ${isActive ? `${colors.bg} ${colors.border} border-2 scale-105` : ''}
              ${isPassed ? 'bg-green-50' : ''}
              ${isFuture ? 'bg-gray-50 opacity-50' : ''}
            `}
          >
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
              ${isActive ? `${colors.text} bg-white border-2 ${colors.border}` : ''}
              ${isPassed ? 'bg-green-500 text-white' : ''}
              ${isFuture ? 'bg-gray-300 text-gray-600' : ''}
            `}>
              {isPassed ? (
                <Icons.Check size={20} />
              ) : (
                <Icon size={20} />
              )}
            </div>

            <div className="flex-1">
              <p className={`font-bold ${isActive ? colors.text : isPassed ? 'text-green-800' : 'text-gray-600'}`}>
                {info.ar_title}
              </p>
              {(isActive || isPassed) && (
                <p className="text-sm text-gray-600 mt-1">
                  {info.ar_description}
                </p>
              )}
            </div>

            {isPassed && (
              <Icons.CheckCircle className="text-green-500" size={24} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * مثال على Dropdown لتغيير حالة الطلب
 *
 * الاستخدام:
 * <StatusSelector
 *   currentStatus="processing"
 *   onStatusChange={(newStatus) => updateOrder(newStatus)}
 * />
 */
export function StatusSelector({
  currentStatus,
  onStatusChange
}: {
  currentStatus: string;
  onStatusChange: (status: string) => void;
}) {
  const normalStatuses = [
    'pending',
    'accepted',
    'processing',
    'ready',
    'shipping',
    'delivering',
    'completed',
    'cancelled',
    'rejected'
  ];

  return (
    <select
      value={currentStatus}
      onChange={(e) => onStatusChange(e.target.value)}
      className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none text-lg font-semibold"
    >
      {normalStatuses.map(statusKey => {
        const info = getStatusInfoSync(statusKey);
        return (
          <option key={statusKey} value={statusKey}>
            {info.ar_title}
          </option>
        );
      })}
    </select>
  );
}

/**
 * مثال على استخدام جميع المكونات معاً
 */
export function StatusExample() {
  const [currentStatus, setCurrentStatus] = React.useState('shipping');

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          أمثلة على استخدام حالات الشحن
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-gray-700 mb-2">1. Badge بسيط</h3>
            <StatusBadge status={currentStatus} />
          </div>

          <div>
            <h3 className="font-bold text-gray-700 mb-2">2. Card كامل</h3>
            <StatusCard status={currentStatus} driverName="محمد أحمد" />
          </div>

          <div>
            <h3 className="font-bold text-gray-700 mb-2">3. تغيير الحالة</h3>
            <StatusSelector
              currentStatus={currentStatus}
              onStatusChange={setCurrentStatus}
            />
          </div>

          <div>
            <h3 className="font-bold text-gray-700 mb-2">4. Timeline تتبع الطلب</h3>
            <StatusTimeline currentStatus={currentStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}

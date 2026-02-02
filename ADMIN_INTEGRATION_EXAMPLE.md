# مثال: إضافة صفحة إدارة مواقع المتاجر

## الطريقة 1: إضافة كمسار منفصل (موصى به)

### في ملف `src/App.tsx`:

```tsx
// 1. أضف الاستيراد في الأعلى
import VendorLocationManager from './components/VendorLocationManager';

// 2. في component App، أضف المسار الجديد
const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <BackButtonHandler />
        <Routes>
          <Route path="/" element={<AppContent />} />

          {/* المسار الجديد لإدارة المواقع */}
          <Route path="/admin/vendor-locations" element={<VendorLocationManager />} />

          <Route path="*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};
```

### الوصول للصفحة:
افتح المتصفح على: `http://localhost:5173/admin/vendor-locations`

---

## الطريقة 2: إضافة في القائمة الجانبية

إذا كنت تريد إضافة رابط في `Sidebar`:

### في ملف `src/components/Sidebar.tsx`:

```tsx
// أضف في قائمة الروابط
<button
  onClick={() => {
    window.location.href = '/admin/vendor-locations';
  }}
  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors"
>
  <MapPin size={20} />
  <span>إدارة مواقع المتاجر</span>
</button>
```

---

## الطريقة 3: صفحة إدارية مخصصة

إذا كان لديك صفحة إدارة منفصلة، أنشئ ملف `src/pages/AdminDashboard.tsx`:

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Store, Users, Settings } from 'lucide-react';
import VendorLocationManager from '../components/VendorLocationManager';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b" dir="rtl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
        </div>
      </div>

      {/* Admin Navigation */}
      <div className="max-w-7xl mx-auto px-4 py-6" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Link
            to="/admin/vendor-locations"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <MapPin className="text-emerald-600 mb-3" size={32} />
            <h3 className="font-bold text-gray-900">مواقع المتاجر</h3>
            <p className="text-sm text-gray-600 mt-1">تحديد مواقع GPS</p>
          </Link>

          <Link
            to="/admin/vendors"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <Store className="text-blue-600 mb-3" size={32} />
            <h3 className="font-bold text-gray-900">المتاجر</h3>
            <p className="text-sm text-gray-600 mt-1">إدارة المتاجر</p>
          </Link>

          <Link
            to="/admin/users"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <Users className="text-purple-600 mb-3" size={32} />
            <h3 className="font-bold text-gray-900">المستخدمين</h3>
            <p className="text-sm text-gray-600 mt-1">إدارة الحسابات</p>
          </Link>

          <Link
            to="/admin/settings"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <Settings className="text-gray-600 mb-3" size={32} />
            <h3 className="font-bold text-gray-900">الإعدادات</h3>
            <p className="text-sm text-gray-600 mt-1">إعدادات النظام</p>
          </Link>
        </div>

        {/* Main Content */}
        <VendorLocationManager />
      </div>
    </div>
  );
}
```

ثم أضف في `App.tsx`:

```tsx
import AdminDashboard from './pages/AdminDashboard';

// في Routes:
<Route path="/admin" element={<AdminDashboard />} />
<Route path="/admin/vendor-locations" element={<VendorLocationManager />} />
```

---

## الطريقة 4: الوصول المباشر بدون تعديل

إذا كنت لا تريد تعديل `App.tsx` الآن:

### أنشئ ملف جديد `src/admin.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import VendorLocationManager from './components/VendorLocationManager';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <VendorLocationManager />
    </AuthProvider>
  </React.StrictMode>,
);
```

### أنشئ ملف `admin.html` في المجلد `public/`:

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>إدارة مواقع المتاجر</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/admin.tsx"></script>
  </body>
</html>
```

افتح على: `http://localhost:5173/admin.html`

---

## حماية الصفحة (اختياري)

إذا كنت تريد حماية الصفحة للمسؤولين فقط:

### أنشئ مكون `AdminRoute`:

```tsx
// src/components/AdminRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // تحقق من أن المستخدم مسؤول
  // (يجب أن يكون لديك حقل is_admin في جدول المستخدمين)
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

### استخدمه في Routes:

```tsx
import AdminRoute from './components/AdminRoute';

<Route
  path="/admin/vendor-locations"
  element={
    <AdminRoute>
      <VendorLocationManager />
    </AdminRoute>
  }
/>
```

---

## اختصار سريع

**أسرع طريقة للتجربة الآن:**

1. افتح Terminal في مجلد المشروع
2. شغل السيرفر: `npm run dev`
3. أنشئ ملف مؤقت للاختبار: `test-admin.html`

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>اختبار إدارة المواقع</title>
  <script type="module">
    import VendorLocationManager from './src/components/VendorLocationManager';
    // الكود هنا
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

4. افتح في المتصفح

---

## الخيار الموصى به

**للاستخدام في الإنتاج:**
- استخدم **الطريقة 1** (إضافة كمسار في Routes)
- أضف حماية باستخدام AdminRoute
- أضف رابط في Sidebar للوصول السريع

**للتجربة والتطوير:**
- استخدم **الطريقة 4** (صفحة منفصلة)
- سهلة وسريعة ولا تؤثر على الكود الحالي

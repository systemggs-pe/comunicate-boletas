import React from 'react';

function Icon({size = 20, className = '', children, ...props}) {
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;
}

export const FileText = props => <Icon {...props}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h5"/></Icon>;
export const LogOut = props => <Icon {...props}><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></Icon>;
export const Settings = props => <Icon {...props}><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></Icon>;
export const LogIn = props => <Icon {...props}><path d="M14 4h5v16h-5M10 8l4 4-4 4M14 12H4"/></Icon>;
export const ShieldCheck = props => <Icon {...props}><path d="M12 3l7 3v5c0 4.7-2.7 8-7 10-4.3-2-7-5.3-7-10V6z"/><path d="M9 12l2 2 4-4"/></Icon>;
export const Building2 = props => <Icon {...props}><path d="M4 21V5l8-2v18M12 8h8v13M2 21h20M7 8h2M7 12h2M7 16h2M16 12h1M16 16h1"/></Icon>;
export const Save = props => <Icon {...props}><path d="M5 3h12l3 3v15H4V3zM8 3v6h8V3M8 21v-7h8v7"/></Icon>;
export const AlertCircle = props => <Icon {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></Icon>;
export const CheckCircle2 = props => <Icon {...props}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></Icon>;
export const PackageCheck = props => <Icon {...props}><path d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10"/><path d="M8 15l2 2 4-4"/></Icon>;
export const Search = props => <Icon {...props}><circle cx="11" cy="11" r="7"/><path d="M16 16l4 4"/></Icon>;
export const Edit = props => <Icon {...props}><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3"/></Icon>;
export const Printer = props => <Icon {...props}><path d="M7 8V3h10v5M6 17H4v-7h16v7h-2M7 14h10v7H7z"/><path d="M17 11h.01"/></Icon>;
export const ScanBarcode = props => <Icon {...props}><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 8v8M11 8v8M15 8v8M18 8v8"/></Icon>;
export const X = props => <Icon {...props}><path d="M6 6l12 12M18 6L6 18"/></Icon>;

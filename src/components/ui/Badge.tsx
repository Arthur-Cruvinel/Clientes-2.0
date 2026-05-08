interface BadgeProps {
  children: React.ReactNode;
  variante?: 'default' | 'sucesso' | 'erro' | 'alerta' | 'roxo';
}

const VARIANTES = {
  default: 'bg-gray-100 text-gray-700',
  sucesso: 'bg-green-100 text-green-700',
  erro: 'bg-red-100 text-red-700',
  alerta: 'bg-amber-100 text-amber-700',
  // Roxo claro — família da marca Galápagos. Usado p/ "Fee Isento" (perfil novo).
  roxo: 'bg-purple-100 text-purple-700',
} as const;

export function Badge({ children, variante = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VARIANTES[variante]}`}>
      {children}
    </span>
  );
}

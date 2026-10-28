# Base de Conocimiento — Proceso de Registro de Proveedores
## Periferia IT Group S.A.S.

### 1. Datos Corporativos de Periferia IT Group S.A.S.
- **Razón Social:** Periferia IT Group S.A.S.
- **Tipo de Sociedad:** Sociedad por Acciones Simplificada
- **NIT:** 900123456
- **Dígito de Verificación:** 7
- **País:** Colombia (CO)
- **Ciudad:** Medellín, Antioquia
- **Dirección:** Calle 10 # 43A-25, Oficina 501
- **Código Postal:** 050021
- **Teléfono:** +57 604 555 0100
- **Representante Legal:** Roberto Andrade Salazar (C.C. 71555123, Gerente General)
- **Contacto Comercial:** Laura Gómez Restrepo (lgomez@periferia-ficticia.com)
- **Contacto Financiero:** Camila Ortiz Vélez (facturacion@periferia-ficticia.com)
- **Datos Bancarios:** Bancolombia S.A., Cuenta de Ahorros No. 03100012345, Titular Periferia IT Group S.A.S., SWIFT: COLOCOBM.

### 2. Reglas de Identificación Tributaria por País (RN1)
- **Colombia (CO):** NIT (Número de Identificación Tributaria). Periferia opera con su NIT local.
- **Ecuador (EC):** RUC (Registro Único de Contribuyentes). Periferia solo tiene NIT colombiano; se asigna el NIT con aclaración de identificador extranjero (`requiere_confirmacion`).
- **Honduras (HN):** RTN (Registro Tributario Nacional). Aplica NIT colombiano con aclaración de identificador extranjero (`requiere_confirmacion`).
- **Panamá (PA):** RUC. Aplica NIT colombiano con aclaración de identificador extranjero (`requiere_confirmacion`).
- **Perú (PE):** RUC. Aplica NIT colombiano con aclaración de identificador extranjero (`requiere_confirmacion`).

### 3. Catálogo de Soportes y Vigencias
- `camara_comercio`: Certificado de existencia y representación legal. Vigencia: 30 días.
- `rut`: Registro Único Tributario (DIAN). Vigencia: Permanente (sin vencimiento).
- `certificacion_bancaria`: Certificación bancaria oficial emitida por Bancolombia.
- `parafiscales`: Certificación de pago de seguridad social y aportes parafiscales firmada por revisor fiscal.
- `estados_financieros`: Estados financieros auditados con corte a fin de año fiscal.
- `certificado_iso_9001`: Certificación de calidad ISO 9001:2015.

### 4. Directrices de Cierre y Seguridad
- Si un soporte exigido está ausente o vencido, el paquete **NO puede ser firmado** (`listo_para_firma = false`).
- Todo envío simulado requiere autorización humana previa de la analista.
- Si el cliente exige diligenciar un portal web, se entrega `valores-portal.md` para que la analista transfiera los datos manualmente, protegiendo las credenciales de acceso.


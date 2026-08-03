import { useMemo, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Button from "../common/Button";

function getAssetName(asset) {
  return asset?.name || "جهاز دون اسم";
}

function getAssetNumber(asset) {
  return (
    asset?.asset_number ||
    asset?.assetNumber ||
    asset?.code ||
    "—"
  );
}

function getLocationName(asset) {
  return (
    asset?.location_name ||
    asset?.location?.name ||
    asset?.locations?.name ||
    "موقع غير محدد"
  );
}

function getQrToken(asset) {
  return asset?.qr_token || asset?.qrToken || "";
}

function createPublicUrl(asset, baseUrl) {
  const token = getQrToken(asset);

  if (!token) {
    return "";
  }

  const cleanBaseUrl = String(
    baseUrl ||
      import.meta.env.VITE_APP_URL ||
      window.location.origin
  ).replace(/\/+$/, "");

  return `${cleanBaseUrl}/request/${encodeURIComponent(token)}`;
}

export default function AssetQRCode({
  asset,
  appUrl = "",
  size = 240,
  disabled = false,
  showActions = true,
  onClose,
}) {
  const printableRef = useRef(null);

  const publicUrl = useMemo(
    () => createPublicUrl(asset, appUrl),
    [asset, appUrl]
  );

  function downloadQRCode() {
    if (!asset || !publicUrl || disabled) {
      return;
    }

    const svgElement =
      printableRef.current?.querySelector("svg");

    if (!svgElement) {
      return;
    }

    const serializedSvg = new XMLSerializer().serializeToString(
      svgElement
    );

    const svgBlob = new Blob([serializedSvg], {
      type: "image/svg+xml;charset=utf-8",
    });

    const downloadUrl = URL.createObjectURL(svgBlob);
    const anchor = document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download = `${getAssetNumber(asset)}-qr.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(downloadUrl);
  }

  function printQRCode() {
    if (!asset || !publicUrl || disabled) {
      return;
    }

    const printableContent = printableRef.current?.innerHTML;

    if (!printableContent) {
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=700,height=800"
    );

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <title>QR - ${getAssetName(asset)}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 30px;
              font-family: Tahoma, Arial, sans-serif;
              color: #173231;
              background: #ffffff;
            }

            .qr-print-card {
              width: 420px;
              max-width: 100%;
              margin: 0 auto;
              padding: 30px;
              border: 2px solid #173f3a;
              border-radius: 18px;
              text-align: center;
            }

            .qr-print-brand {
              margin-bottom: 18px;
              font-size: 22px;
              font-weight: 700;
              color: #176c62;
            }

            .qr-print-card h2 {
              margin: 18px 0 8px;
              font-size: 21px;
            }

            .qr-print-card p {
              margin: 6px 0;
              font-size: 14px;
              color: #5e706d;
            }

            .qr-print-instruction {
              margin-top: 20px !important;
              padding: 12px;
              border-radius: 10px;
              background: #edf6f3;
              color: #176c62 !important;
              font-weight: 700;
            }

            svg {
              width: 260px;
              height: 260px;
              max-width: 100%;
            }

            @media print {
              body {
                padding: 0;
              }

              .qr-print-card {
                border: 2px solid #000000;
                break-inside: avoid;
              }
            }
          </style>
        </head>

        <body>
          ${printableContent}

          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  async function copyPublicUrl() {
    if (!publicUrl || disabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const textArea = document.createElement("textarea");

      textArea.value = publicUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";

      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
  }

  if (!asset) {
    return (
      <div className="empty">
        لم يتم تحديد جهاز لعرض رمز QR.
      </div>
    );
  }

  if (!publicUrl) {
    return (
      <div className="form-error" role="alert">
        لا يوجد رمز QR صالح لهذا الجهاز.
      </div>
    );
  }

  return (
    <section
      style={{
        display: "grid",
        gap: "20px",
      }}
    >
      <div
        ref={printableRef}
        className="qr-print-card"
        style={{
          display: "grid",
          justifyItems: "center",
          gap: "10px",
          padding: "24px",
          border: "1px solid #dfe6e4",
          borderRadius: "14px",
          background: "#ffffff",
          textAlign: "center",
        }}
      >
        <div
          className="qr-print-brand"
          style={{
            color: "#176c62",
            fontSize: "18px",
            fontWeight: 700,
          }}
        >
          FixFlow
        </div>

        <QRCodeSVG
          value={publicUrl}
          size={size}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#173f3a"
          title={`رمز الإبلاغ عن عطل في ${getAssetName(asset)}`}
        />

        <h2
          style={{
            margin: "8px 0 0",
            fontSize: "17px",
          }}
        >
          {getAssetName(asset)}
        </h2>

        <p
          style={{
            margin: 0,
            color: "#71817f",
            fontSize: "10px",
          }}
        >
          الرقم الداخلي: {getAssetNumber(asset)}
        </p>

        <p
          style={{
            margin: 0,
            color: "#71817f",
            fontSize: "10px",
          }}
        >
          الموقع: {getLocationName(asset)}
        </p>

        <p
          className="qr-print-instruction"
          style={{
            width: "100%",
            margin: "8px 0 0",
            padding: "10px",
            borderRadius: "9px",
            background: "#edf6f3",
            color: "#176c62",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          امسح الرمز للإبلاغ عن عطل
        </p>
      </div>

      <label
        style={{
          display: "grid",
          gap: "7px",
          fontSize: "10px",
          fontWeight: 600,
        }}
      >
        رابط نموذج البلاغ

        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          <input
            type="text"
            value={publicUrl}
            readOnly
            dir="ltr"
            onFocus={(event) => event.target.select()}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "11px",
              border: "1px solid #dfe6e4",
              borderRadius: "8px",
              background: "#f8faf9",
              fontSize: "10px",
            }}
          />

          <Button
            variant="secondary"
            onClick={copyPublicUrl}
            disabled={disabled}
          >
            نسخ
          </Button>
        </div>
      </label>

      {showActions ? (
        <div className="modal-buttons">
          {typeof onClose === "function" ? (
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={disabled}
            >
              إغلاق
            </Button>
          ) : null}

          <Button
            variant="secondary"
            onClick={downloadQRCode}
            disabled={disabled}
          >
            تنزيل QR
          </Button>

          <Button
            onClick={printQRCode}
            disabled={disabled}
          >
            طباعة QR
          </Button>
        </div>
      ) : null}
    </section>
  );
}

import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({
  open,
  title = "تأكيد العملية",
  message = "هل أنت متأكد من تنفيذ هذه العملية؟",
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  loading = false,
  danger = false,
  onConfirm,
  onCancel,
}) {
  function handleConfirm() {
    if (loading) {
      return;
    }

    onConfirm?.();
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      showCloseButton={!loading}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>

          <Button
            className={danger ? "danger-button" : ""}
            loading={loading}
            loadingText="جاري التنفيذ…"
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {danger ? (
        <div className="form-error" role="alert">
          لا يمكن التراجع عن هذه العملية بعد تنفيذها.
        </div>
      ) : null}
    </Modal>
  );
}

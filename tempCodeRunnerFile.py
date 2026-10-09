import os
import tkinter as tk
from tkinter import filedialog, messagebox
from PyPDF2 import PdfReader, PdfWriter


# ===========================
# CLASE PARA QUITAR CONTRASEÑA
# ===========================

class QuitarPasswordPDF:

    def __init__(self, root):

        self.root = root
        self.root.title("Quitar contraseña PDF")
        self.root.geometry("400x250")
        self.root.resizable(False, False)

        self.archivo = ""

        tk.Button(
            root,
            text="Seleccionar PDF",
            command=self.seleccionar_pdf
        ).pack(pady=10)

        self.lbl_archivo = tk.Label(
            root,
            text="Ningún archivo seleccionado",
            wraplength=350
        )

        self.lbl_archivo.pack()

        tk.Label(
            root,
            text="Contraseña:"
        ).pack(pady=(20, 5))

        self.txt_password = tk.Entry(
            root,
            width=30,
            show="*"
        )

        self.txt_password.pack()

        tk.Button(
            root,
            text="Quitar contraseña",
            command=self.quitar_password
        ).pack(pady=20)

    def seleccionar_pdf(self):

        archivo = filedialog.askopenfilename(
            title="Seleccionar PDF",
            filetypes=[("PDF", "*.pdf")]
        )

        if archivo:

            self.archivo = archivo

            self.lbl_archivo.config(
                text=os.path.basename(archivo)
            )

    def quitar_password(self):

        if self.archivo == "":

            messagebox.showerror(
                "Error",
                "Selecciona un PDF."
            )

            return

        password = self.txt_password.get()

        try:

            lector = PdfReader(self.archivo)

            if lector.is_encrypted:

                resultado = lector.decrypt(password)

                if not resultado:

                    messagebox.showerror(
                        "Error",
                        "Contraseña incorrecta."
                    )

                    return

            else:

                respuesta = messagebox.askyesno(
                    "PDF sin contraseña",
                    "Este PDF no tiene contraseña.\n\n¿Deseas guardar una copia?"
                )

                if not respuesta:
                    return

            salida = filedialog.asksaveasfilename(
                title="Guardar PDF",
                defaultextension=".pdf",
                filetypes=[("PDF", "*.pdf")]
            )

            if not salida:
                return

            escritor = PdfWriter()

            for pagina in lector.pages:

                escritor.add_page(pagina)

            with open(salida, "wb") as archivo:

                escritor.write(archivo)

            messagebox.showinfo(
                "Éxito",
                "Se creó un PDF sin contraseña."
            )

        except Exception as e:

            messagebox.showerror(
                "Error",
                f"Ocurrió un error:\n\n{e}"
            )


# ===========================
# INICIO DEL PROGRAMA
# ===========================

root = tk.Tk()

QuitarPasswordPDF(root)

root.mainloop()

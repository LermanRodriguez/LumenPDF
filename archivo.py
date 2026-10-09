# import os
# import tkinter as tk
# from tkinter import filedialog, messagebox
# from PyPDF2 import PdfReader, PdfWriter


# # ===========================
# # CLASE PARA QUITAR CONTRASEÑA
# # ===========================

# class QuitarPasswordPDF:

#     def __init__(self, root):

#         self.root = root
#         self.root.title("Quitar contraseña PDF")
#         self.root.geometry("400x250")
#         self.root.resizable(False, False)

#         self.archivo = ""

#         tk.Button(
#             root,
#             text="Seleccionar PDF",
#             command=self.seleccionar_pdf
#         ).pack(pady=10)

#         self.lbl_archivo = tk.Label(
#             root,
#             text="Ningún archivo seleccionado",
#             wraplength=350
#         )

#         self.lbl_archivo.pack()

#         tk.Label(
#             root,
#             text="Contraseña:"
#         ).pack(pady=(20, 5))

#         self.txt_password = tk.Entry(
#             root,
#             width=30,
#             show="*"
#         )

#         self.txt_password.pack()

#         tk.Button(
#             root,
#             text="Quitar contraseña",
#             command=self.quitar_password
#         ).pack(pady=20)

#     def seleccionar_pdf(self):

#         archivo = filedialog.askopenfilename(
#             title="Seleccionar PDF",
#             filetypes=[("PDF", "*.pdf")]
#         )

#         if archivo:

#             self.archivo = archivo

#             self.lbl_archivo.config(
#                 text=os.path.basename(archivo)
#             )

#     def quitar_password(self):

#         if self.archivo == "":

#             messagebox.showerror(
#                 "Error",
#                 "Selecciona un PDF."
#             )

#             return

#         password = self.txt_password.get()

#         try:

#             lector = PdfReader(self.archivo)

#             if lector.is_encrypted:

#                 resultado = lector.decrypt(password)

#                 if not resultado:

#                     messagebox.showerror(
#                         "Error",
#                         "Contraseña incorrecta."
#                     )

#                     return

#             else:

#                 respuesta = messagebox.askyesno(
#                     "PDF sin contraseña",
#                     "Este PDF no tiene contraseña.\n\n¿Deseas guardar una copia?"
#                 )

#                 if not respuesta:
#                     return

#             salida = filedialog.asksaveasfilename(
#                 title="Guardar PDF",
#                 defaultextension=".pdf",
#                 filetypes=[("PDF", "*.pdf")]
#             )

#             if not salida:
#                 return

#             escritor = PdfWriter()

#             for pagina in lector.pages:

#                 escritor.add_page(pagina)

#             with open(salida, "wb") as archivo:

#                 escritor.write(archivo)

#             messagebox.showinfo(
#                 "Éxito",
#                 "Se creó un PDF sin contraseña."
#             )

#         except Exception as e:

#             messagebox.showerror(
#                 "Error",
#                 f"Ocurrió un error:\n\n{e}"
#             )


# # ===========================
# # INICIO DEL PROGRAMA
# # ===========================

# root = tk.Tk()

# QuitarPasswordPDF(root)

# root.mainloop()




import os
import tkinter as tk
from tkinter import filedialog, messagebox
from PyPDF2 import PdfMerger, PdfReader, PdfWriter


# ===========================
# CLASE PARA UNIR PDFs
# ===========================

class UnidorPDF:

    def __init__(self, root):

        self.root = root
        self.root.title("Unidor de PDFs")

        self.archivos = []

        tk.Button(
            root,
            text="Seleccionar carpeta",
            command=self.cargar_pdfs
        ).pack(pady=5)

        self.lista = tk.Listbox(root, width=80, height=20)
        self.lista.pack(padx=10, pady=10)

        frame_botones = tk.Frame(root)
        frame_botones.pack()

        tk.Button(
            frame_botones,
            text="↑ Subir",
            command=self.subir
        ).grid(row=0, column=0, padx=5)

        tk.Button(
            frame_botones,
            text="↓ Bajar",
            command=self.bajar
        ).grid(row=0, column=1, padx=5)

        tk.Button(
            root,
            text="Unir PDFs",
            command=self.unir_pdfs
        ).pack(pady=10)

    def cargar_pdfs(self):

        carpeta = filedialog.askdirectory(
            title="Selecciona la carpeta"
        )

        if not carpeta:
            return

        self.archivos = []

        self.lista.delete(0, tk.END)

        for archivo in os.listdir(carpeta):

            if archivo.lower().endswith(".pdf"):

                ruta = os.path.join(carpeta, archivo)

                self.archivos.append(ruta)

        for archivo in self.archivos:

            self.lista.insert(
                tk.END,
                os.path.basename(archivo)
            )

    def subir(self):

        seleccion = self.lista.curselection()

        if not seleccion or seleccion[0] == 0:
            return

        i = seleccion[0]

        self.archivos[i], self.archivos[i - 1] = \
            self.archivos[i - 1], self.archivos[i]

        self.actualizar_lista()

        self.lista.selection_set(i - 1)

    def bajar(self):

        seleccion = self.lista.curselection()

        if not seleccion or seleccion[0] == len(self.archivos) - 1:
            return

        i = seleccion[0]

        self.archivos[i], self.archivos[i + 1] = \
            self.archivos[i + 1], self.archivos[i]

        self.actualizar_lista()

        self.lista.selection_set(i + 1)

    def actualizar_lista(self):

        self.lista.delete(0, tk.END)

        for archivo in self.archivos:

            self.lista.insert(
                tk.END,
                os.path.basename(archivo)
            )

    def unir_pdfs(self):

        if not self.archivos:

            messagebox.showerror(
                "Error",
                "No hay PDFs cargados."
            )

            return

        salida = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF", "*.pdf")],
            title="Guardar PDF unido"
        )

        if not salida:
            return

        merger = PdfMerger()

        for archivo in self.archivos:

            merger.append(archivo)

        merger.write(salida)
        merger.close()

        messagebox.showinfo(
            "Éxito",
            "PDF creado correctamente."
        )


# ===========================
# CLASE PARA DIVIDIR PDF
# ===========================

class DividirPDF:

    def __init__(self, root):

        self.root = root
        self.root.title("Dividir PDF")

        self.archivo = ""

        tk.Button(
            root,
            text="Seleccionar PDF",
            command=self.seleccionar_pdf
        ).pack(pady=10)

        self.lbl_archivo = tk.Label(
            root,
            text="Ningún archivo seleccionado"
        )

        self.lbl_archivo.pack()

        frame = tk.Frame(root)
        frame.pack(pady=10)

        tk.Label(
            frame,
            text="Desde página"
        ).grid(row=0, column=0, padx=5, pady=5)

        self.desde = tk.Entry(frame, width=10)
        self.desde.grid(row=0, column=1)

        tk.Label(
            frame,
            text="Hasta página"
        ).grid(row=1, column=0, padx=5, pady=5)

        self.hasta = tk.Entry(frame, width=10)
        self.hasta.grid(row=1, column=1)

        tk.Button(
            root,
            text="Dividir PDF",
            command=self.dividir_pdf
        ).pack(pady=10)

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

    def dividir_pdf(self):

        if self.archivo == "":

            messagebox.showerror(
                "Error",
                "Selecciona un PDF."
            )

            return

        try:

            inicio = int(self.desde.get())
            fin = int(self.hasta.get())

        except ValueError:

            messagebox.showerror(
                "Error",
                "Ingresa números válidos."
            )

            return

        lector = PdfReader(self.archivo)

        total = len(lector.pages)

        if inicio < 1 or fin > total or inicio > fin:

            messagebox.showerror(
                "Error",
                f"El PDF tiene {total} páginas."
            )

            return

        salida = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF", "*.pdf")],
            title="Guardar PDF"
        )

        if not salida:
            return

        escritor = PdfWriter()

        for i in range(inicio - 1, fin):

            escritor.add_page(lector.pages[i])

        with open(salida, "wb") as archivo:

            escritor.write(archivo)

        messagebox.showinfo(
            "Éxito",
            "PDF dividido correctamente."
        )


# ===========================
# MENÚ PRINCIPAL
# ===========================

def elegir_opcion():

    ventana = tk.Tk()

    ventana.title("Herramientas PDF")
    ventana.geometry("300x180")
    ventana.resizable(False, False)

    tk.Label(
        ventana,
        text="¿Qué deseas hacer?",
        font=("Arial", 14)
    ).pack(pady=20)

    def abrir_unir():

        ventana.destroy()

        root = tk.Tk()

        UnidorPDF(root)

        root.mainloop()

    def abrir_dividir():

        ventana.destroy()

        root = tk.Tk()

        DividirPDF(root)

        root.mainloop()

    tk.Button(
        ventana,
        text="Unir PDFs",
        width=20,
        height=2,
        command=abrir_unir
    ).pack(pady=5)

    tk.Button(
        ventana,
        text="Dividir PDF",
        width=20,
        height=2,
        command=abrir_dividir
    ).pack(pady=5)

    ventana.mainloop()


# ===========================
# INICIO DEL PROGRAMA
# ===========================

elegir_opcion()


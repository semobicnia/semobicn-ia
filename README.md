# SEMOBICN IA

Sistema interno para transformar croquis de imóveis em documentos padronizados de
Informações Topográficas.

## Tecnologias

- Next.js, TypeScript e Tailwind CSS
- OpenAI Responses API para leitura visual e extração estruturada de PDFs
- Neon PostgreSQL para os processos
- Cloudinary para armazenamento privado dos croquis
- PDF-Lib para geração do documento final

## Executar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

Sem variáveis externas, a interface pode ser testada com o botão **Usar exemplo**.
Para analisar croquis reais, configure as variáveis descritas em `.env.example`.

## Banco de dados

Execute o conteúdo de `database/schema.sql` no editor SQL do Neon.

## Publicação

Importe este repositório na Vercel e cadastre as mesmas variáveis de ambiente do
arquivo `.env.example`. Não envie o arquivo `.env.local` ao GitHub.

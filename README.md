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

## Acesso institucional

O sistema usa login com Google e permite somente e-mails ativos na tabela
`app_users`. O administrador inicial é `semobicn.ia@gmail.com`.

No Google Cloud, crie um cliente OAuth do tipo **Aplicativo da Web** e cadastre:

- origem autorizada: `https://semobicn-ia.vercel.app`
- redirecionamento autorizado:
  `https://semobicn-ia.vercel.app/api/auth/callback/google`

Na Vercel, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL` e `INITIAL_ADMIN_EMAIL`.

## Banco de dados

Execute o conteúdo de `database/schema.sql` no editor SQL do Neon.

O esquema cria:

- `sex_options`: opções Feminino, Masculino e Não informado;
- `municipal_staff`: responsáveis técnicos e fiscais de obras, com sexo,
  registro e situação ativa;
- `topographic_processes`: processos analisados, incluindo o sexo do posseiro
  e os servidores escolhidos para assinar o documento.

O endpoint `GET /api/reference-data` carrega essas opções na revisão. Quando
`DATABASE_URL` ainda não estiver configurada, o sistema usa os servidores
padrão localmente para não interromper a geração dos documentos.

## Publicação

Importe este repositório na Vercel e cadastre as mesmas variáveis de ambiente do
arquivo `.env.example`. Não envie o arquivo `.env.local` ao GitHub.

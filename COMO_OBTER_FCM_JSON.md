# 🔑 Como Obter o Arquivo JSON do Firebase (FCM)

Este guia explica passo a passo como criar/obter o arquivo JSON necessário para configurar push notifications no EAS.

## 📋 Passo a Passo

### 1. Acessar o Firebase Console

1. Acesse: **https://console.firebase.google.com**
2. Faça login com sua conta Google

### 2. Criar ou Selecionar um Projeto

**Opção A: Criar um Novo Projeto**
1. Clique em "Adicionar projeto" ou "Create a project"
2. Digite o nome do projeto (ex: "Crea Glass" ou "CreaGlass")
3. Clique em "Continuar" / "Continue"
4. Aceite os termos e clique em "Criar projeto" / "Create project"
5. Aguarde a criação (pode levar alguns segundos)

**Opção B: Usar um Projeto Existente**
1. Se você já tem um projeto Firebase, selecione-o na lista

### 3. Adicionar App Android (se necessário)

Se você ainda não adicionou um app Android ao projeto:

1. No dashboard do projeto, clique no ícone Android (ou "Add app")
2. Digite o **Package name**: `com.anonymous.CreaGlass`
   - Este é o mesmo package name do seu `app.json`
3. Clique em "Registrar app" / "Register app"
4. Baixe o arquivo `google-services.json` (você pode ignorar este passo por enquanto)
5. Clique em "Próximo" / "Next" até concluir

**Nota:** Você pode pular este passo se só precisa do Service Account para FCM.

### 4. Obter o Service Account Key (JSON)

1. No Firebase Console, clique no **ícone de engrenagem** (⚙️) no canto superior esquerdo
2. Selecione **"Project settings"** / **"Configurações do projeto"**
3. Vá para a aba **"Service Accounts"** / **"Contas de serviço"**
4. Você verá uma seção chamada **"Firebase Admin SDK"**
5. Clique no botão **"Generate new private key"** / **"Gerar nova chave privada"**
6. Uma janela de confirmação aparecerá - clique em **"Generate key"** / **"Gerar chave"**
7. Um arquivo JSON será baixado automaticamente

### 5. Salvar o Arquivo

1. O arquivo baixado terá um nome como:
   ```
   seu-projeto-firebase-adminsdk-xxxxx-aaaaaaaaaa.json
   ```
2. **Salve este arquivo em um local seguro**, por exemplo:
   - Na pasta do projeto: `/Users/higor/Documents/Crea Glass/Crea_Glass/`
   - Ou na pasta Downloads: `/Users/higor/Downloads/`
3. **IMPORTANTE:** Anote o caminho completo do arquivo

### 6. Usar no EAS

Quando o EAS pedir o caminho do arquivo, forneça o caminho completo:

**Exemplo se salvou na pasta do projeto:**
```
/Users/higor/Documents/Crea Glass/Crea_Glass/seu-projeto-firebase-adminsdk-xxxxx.json
```

**Exemplo se salvou em Downloads:**
```
/Users/higor/Downloads/seu-projeto-firebase-adminsdk-xxxxx.json
```

## ⚠️ Importante

- **NÃO** commite este arquivo JSON no Git (ele contém credenciais sensíveis)
- Mantenha o arquivo seguro e privado
- Você só precisa fazer isso **uma vez** - o EAS salva as credenciais

## 🔍 Verificar se Já Tem um Projeto Firebase

Se você não tem certeza se já criou um projeto Firebase antes:

1. Acesse: https://console.firebase.google.com
2. Veja a lista de projetos
3. Se encontrar um projeto relacionado ao Crea Glass, use esse
4. Se não encontrar nenhum, crie um novo (Passo 2 acima)

## 📝 Resumo Rápido

1. ✅ Acesse https://console.firebase.google.com
2. ✅ Crie/selecione um projeto
3. ✅ Project Settings > Service Accounts
4. ✅ Generate new private key
5. ✅ Baixe o arquivo JSON
6. ✅ Salve em local seguro
7. ✅ Forneça o caminho completo para o EAS

## 🆘 Problemas Comuns

### "Não consigo encontrar Service Accounts"
- Certifique-se de estar na aba correta: Project Settings > Service Accounts
- Pode estar em "Contas de serviço" se o console estiver em português

### "O arquivo não baixa"
- Verifique se o bloqueador de pop-ups está desabilitado
- Tente em outro navegador

### "Não tenho permissão"
- Certifique-se de estar logado com uma conta que tem acesso ao projeto
- Se necessário, peça ao administrador do projeto para gerar a chave

## ✅ Depois de Configurar

Após fornecer o arquivo JSON ao EAS:
- ✅ As credenciais serão salvas automaticamente
- ✅ Você não precisará fazer isso novamente
- ✅ Push notifications funcionarão em builds standalone

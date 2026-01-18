# 📱 Guia para Gerar APK

Este projeto usa **EAS Build** (Expo Application Services) para gerar builds de produção.

## 🚀 Pré-requisitos

1. **Conta Expo**: Você precisa estar logado no Expo
   ```bash
   npx eas login
   ```

2. **EAS CLI**: Já está instalado como dependência (`eas-cli`)

## 📦 Gerar APK

### Opção 1: Build Preview (Recomendado para Teste)

```bash
npm run build:android:preview
```

Ou diretamente:
```bash
npx eas build --platform android --profile preview
```

**Perfil Preview:**
- Gera **APK** (instalável diretamente)
- Distribuição interna
- Ideal para testes e distribuição para outros dispositivos

### Opção 2: Build Production

```bash
npm run build:android:production
```

Ou diretamente:
```bash
npx eas build --platform android --profile production
```

**Perfil Production:**
- Gera **APK** (instalável diretamente)
- Versão incrementada automaticamente
- Para distribuição final

### Opção 3: Build Development (Com Development Client)

```bash
npm run build:android:dev
```

Ou diretamente:
```bash
npx eas build --platform android --profile development
```

## 📥 Download do APK

Após o build ser concluído:

1. O EAS vai exibir um link para download no terminal
2. Você também pode acessar: https://expo.dev/accounts/[seu-usuario]/projects/Crea2/builds
3. O APK estará disponível para download

## 🔍 Verificar Builds

Para ver a lista de builds:

```bash
npm run build:list
```

Ou:
```bash
npx eas build:list --platform android
```

## ⚙️ Configuração Atual

O projeto está configurado para gerar **APK** (não AAB) em todos os perfis:
- ✅ `development`: APK
- ✅ `preview`: APK  
- ✅ `production`: APK

Configuração está em `eas.json` e `app.json`.

## 🎯 Próximos Passos Após o Build

1. Baixe o APK do link fornecido pelo EAS
2. Transfira o APK para o dispositivo Android
3. No dispositivo, permita instalação de fontes desconhecidas:
   - Configurações → Segurança → Fontes Desconhecidas
4. Abra o arquivo APK e instale

## 📝 Notas Importantes

- O build é feito na nuvem (EAS Build), não localmente
- É necessário estar logado no Expo
- O primeiro build pode demorar mais (~15-30 minutos)
- Builds subsequentes são mais rápidos

## 🆘 Solução de Problemas

### Erro: "Not logged in"
```bash
npx eas login
```

### Erro: "EAS CLI not found"
```bash
npm install -g eas-cli
```

### Ver status do build
Acesse: https://expo.dev/accounts/[seu-usuario]/projects/Crea2/builds

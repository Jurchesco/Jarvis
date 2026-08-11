import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      setError("Wypełnij wszystkie wymagane pola.");
      return;
    }
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne.");
      return;
    }

    setError(null);
    setLoading(true);
    const { error: err } = await signUp(
      email.trim(),
      password,
      displayName.trim() || undefined,
    );
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
  };

  // Success state
  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center px-6">
        <View className="bg-surface rounded-2xl p-6 border border-border items-center">
          <Text className="text-4xl mb-3">✅</Text>
          <Text className="text-text-primary text-xl font-bold mb-2 text-center">
            Konto zostało utworzone!
          </Text>
          <Text className="text-text-secondary text-center mb-6">
            Sprawdź swoją skrzynkę e-mail, aby potwierdzić konto, a następnie zaloguj się.
          </Text>
          <TouchableOpacity
            className="bg-primary rounded-xl py-3.5 px-6 items-center"
            onPress={() => router.replace("/auth/login")}
          >
            <Text className="text-white font-bold text-base">Przejdź do logowania</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="items-center mb-10">
            <Text className="text-text-primary text-3xl font-bold">Utwórz konto</Text>
            <Text className="text-text-secondary text-base mt-2">
              Dołącz do Stravio i zacznij śledzić swoje treningi.
            </Text>
          </View>

          {/* Form */}
          <View className="bg-surface rounded-2xl p-5 border border-border">
            <Text className="text-text-secondary text-sm mb-1.5">Nazwa wyświetlana</Text>
            <TextInput
              className="bg-background text-text-primary rounded-xl px-4 py-3 text-base border border-border mb-4"
              placeholder="Twoje imię"
              placeholderTextColor="#6b6b7b"
              value={displayName}
              onChangeText={setDisplayName}
            />

            <Text className="text-text-secondary text-sm mb-1.5">Email *</Text>
            <TextInput
              className="bg-background text-text-primary rounded-xl px-4 py-3 text-base border border-border mb-4"
              placeholder="you@example.com"
              placeholderTextColor="#6b6b7b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text className="text-text-secondary text-sm mb-1.5">Hasło *</Text>
            <TextInput
              className="bg-background text-text-primary rounded-xl px-4 py-3 text-base border border-border mb-4"
              placeholder="••••••••"
              placeholderTextColor="#6b6b7b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Text className="text-text-secondary text-sm mb-1.5">Potwierdź hasło *</Text>
            <TextInput
              className="bg-background text-text-primary rounded-xl px-4 py-3 text-base border border-border mb-4"
              placeholder="••••••••"
              placeholderTextColor="#6b6b7b"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            {error && (
              <Text className="text-red-500 text-sm mb-4">{error}</Text>
            )}

            <TouchableOpacity
              className="bg-primary rounded-xl py-3.5 items-center"
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Utwórz konto</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Link to login */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-text-secondary">Masz już konto? </Text>
            <TouchableOpacity onPress={() => router.replace("/auth/login")}>
              <Text className="text-primary font-bold">Zaloguj się</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

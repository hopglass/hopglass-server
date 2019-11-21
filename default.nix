{ pkgs ? import <nixpkgs> {} }:
with pkgs;

yarn2nix-moretea.mkYarnPackage {
  src = ./.;
  pname = "hopglass-server";
  version = "0.1.3";
}
